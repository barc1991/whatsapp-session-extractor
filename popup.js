document.addEventListener('DOMContentLoaded', function() {
  const extractBtn = document.getElementById('extractBtn');
  const status = document.getElementById('status');
  const loader = document.getElementById('loader');

  // Verificar se estamos em uma aba do WhatsApp
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const url = tabs[0]?.url || '';
    if (!url.includes('web.whatsapp.com')) {
      setStatus('⚠️ Abra o WhatsApp Web primeiro', 'error');
      extractBtn.disabled = true;
    } else {
      setStatus('✅ WhatsApp Web detectado', 'success');
      extractBtn.disabled = false;
    }
  });

  extractBtn.addEventListener('click', function() {
    extractBtn.disabled = true;
    loader.style.display = 'block';
    setStatus('🔄 Extraindo dados...', 'info');

    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs[0]?.url?.includes('web.whatsapp.com')) {
        setStatus('❌ Abra o WhatsApp Web', 'error');
        extractBtn.disabled = false;
        loader.style.display = 'none';
        return;
      }

      chrome.scripting.executeScript({
        target: {tabId: tabs[0].id},
        function: extractWhatsAppSession
      }, (results) => {
        loader.style.display = 'none';
        extractBtn.disabled = false;
        
        if (chrome.runtime.lastError) {
          setStatus('❌ Erro: ' + chrome.runtime.lastError.message, 'error');
          return;
        }

        if (results && results[0] && results[0].result) {
          setStatus('✅ Sessão extraída com sucesso!', 'success');
          // O download é iniciado pelo código injetado
        } else {
          setStatus('❌ Falha ao extrair. Tente novamente.', 'error');
        }
      });
    });
  });

  function setStatus(msg, type = 'info') {
    const status = document.getElementById('status');
    status.textContent = msg;
    status.className = '';
    if (type === 'success') status.classList.add('status-success');
    else if (type === 'error') status.classList.add('status-error');
    else if (type === 'info') status.classList.add('status-info');
  }
});

// Função que será injetada na página
function extractWhatsAppSession() {
  // Seu código de extração aqui
  // (o mesmo código fornecido)
  return (async () => {
    const b64 = (bytes) => {
      const arr = bytes instanceof ArrayBuffer ? new Uint8Array(bytes)
        : ArrayBuffer.isView(bytes) ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
        : new Uint8Array(bytes);
      let s = ''; for (const x of arr) s += String.fromCharCode(x); return btoa(s);
    };
    const fromB64 = (v) => Uint8Array.from(atob(v), (c) => c.charCodeAt(0));
    const ls = (k) => localStorage.getItem(k);
    const lsj = (k) => { const v = ls(k); if (v == null) return null; try { return JSON.parse(v); } catch { return v; } };

    const getRecord = (dbName, storeName, key) => new Promise((res, rej) => {
      const r = indexedDB.open(dbName);
      r.onerror = () => rej(r.error);
      r.onsuccess = () => {
        const db = r.result; const tx = db.transaction(storeName, 'readonly');
        const g = tx.objectStore(storeName).get(key);
        g.onsuccess = () => { db.close(); res(g.result); };
        g.onerror = () => { db.close(); rej(g.error); };
      };
    });

    try {
      // ---- Noise keypair: candidatos (o whatsmeow escolhe o válido via priv->pub) ----
      const dbKey = (await getRecord('wawc_db_enc', 'keys', 1)).key; // CryptoKey não-extraível
      const salt = fromB64(lsj('WAWebEncKeySalt'));
      const ivs = (lsj('WANoiseInfoIv') || []).map(fromB64);
      const noise = lsj('WANoiseInfo');
      const noisePriv = fromB64(noise.privKey), noisePub = fromB64(noise.pubKey);
      const noiseCandidates = [];
      for (let i = 0; i < ivs.length; i++) for (let j = 0; j < ivs.length; j++) {
        try {
          const key = await crypto.subtle.deriveKey(
            { name: 'HKDF', hash: 'SHA-256', salt, info: new Uint8Array([0]) },
            dbKey, { name: 'AES-CBC', length: 128 }, false, ['decrypt']);
          const pv = await crypto.subtle.decrypt({ name: 'AES-CBC', iv: ivs[i] }, key, noisePriv);
          const pb = await crypto.subtle.decrypt({ name: 'AES-CBC', iv: ivs[j] }, key, noisePub);
          if (pv.byteLength === 32 && pb.byteLength === 32)
            noiseCandidates.push({ private: b64(pv), public: b64(pb) });
        } catch { /* combinação de IV inválida */ }
      }

      // ---- Identidade Signal estática (AES-CTR com o encKey do próprio registro) ----
      const decStatic = async (name) => {
        const rec = await getRecord('signal-storage', 'signal-meta-store', name);
        const pt = await crypto.subtle.decrypt(
          { name: 'AES-CTR', counter: new Uint8Array(16), length: 64 }, rec.value.encKey, rec.value.value);
        if (pt.byteLength !== 32) throw new Error(name + ' tamanho inesperado ' + pt.byteLength);
        return b64(pt);
      };
      const identityKey = {
        private: await decStatic('signal_static_privkey'),
        public: await decStatic('signal_static_pubkey'),
      };

      // ---- ADV signed identity + registration id ----
      const adv = (await getRecord('signal-storage', 'signal-meta-store', 'adv_signed_identity')).value;
      const account = {
        details: b64(adv.details),
        accountSignatureKey: b64(adv.accountSignatureKey),
        accountSignature: b64(adv.accountSignature),
        deviceSignature: b64(adv.deviceSignature),
      };
      const registrationId = Number((await getRecord('signal-storage', 'signal-meta-store', 'signal_reg_id')).value);

      // ---- JIDs (companion device) ----
      const norm = (v) => (v == null ? null : String(v).replace('@c.us', '@s.whatsapp.net'));
      const id = norm(lsj('last-wid-md'));
      const lid = norm(lsj('WALid'));

      const out = {
        noiseCandidates, identityKey, registrationId,
        advSecretKey: noise.recoveryToken ?? null,
        account, id, lid, platform: 'android',
        _raw: { lastWidMd: ls('last-wid-md'), waLid: ls('WALid') },
      };

      const json = JSON.stringify(out, null, 2);
      console.log('%c[extract] OK', 'color:green;font-weight:bold',
        { noiseCandidates: noiseCandidates.length, id, lid, registrationId });
      console.log(json);
      
      try { copy(out); console.log('%c[extract] JSON copiado pro clipboard.', 'color:green'); } catch {}
      try {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
        a.download = 'wa-session.json'; a.click();
        console.log('%c[extract] download de wa-session.json iniciado.', 'color:green');
      } catch {}
      return out;
    } catch (error) {
      console.error('Erro na extração:', error);
      throw error;
    }
  })();
}