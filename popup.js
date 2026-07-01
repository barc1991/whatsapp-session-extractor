const WA_URL = 'web.whatsapp.com';

// Guarda o último JSON extraído para os botões "Copiar" e "Baixar novamente".
let lastResult = null;

document.addEventListener('DOMContentLoaded', () => {
  const extractBtn = document.getElementById('extractBtn');
  const copyBtn = document.getElementById('copyBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const actions = document.getElementById('actions');
  const loader = document.getElementById('loader');
  const versionLine = document.getElementById('versionLine');

  // Verifica se a aba ativa é o WhatsApp Web.
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const url = tabs[0]?.url || '';
    if (!url.includes(WA_URL)) {
      setStatus('⚠️ Abra o WhatsApp Web primeiro', 'error');
      extractBtn.disabled = true;
    } else {
      setStatus('✅ WhatsApp Web detectado', 'success');
      extractBtn.disabled = false;
    }
  });

  extractBtn.addEventListener('click', () => {
    extractBtn.disabled = true;
    actions.hidden = true;
    versionLine.hidden = true;
    loader.style.display = 'block';
    setStatus('🔄 Extraindo sessão...', 'info');

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.url?.includes(WA_URL)) {
        finishError('Abra o WhatsApp Web e faça login antes de extrair.');
        return;
      }

      chrome.scripting.executeScript(
        {
          target: { tabId: tab.id },
          world: 'MAIN', // acesso a window.Debug p/ detectar a versão do WhatsApp Web
          func: extractWhatsAppSession,
        },
        (results) => {
          loader.style.display = 'none';
          extractBtn.disabled = false;

          if (chrome.runtime.lastError) {
            finishError(chrome.runtime.lastError.message);
            return;
          }

          const res = results && results[0] && results[0].result;
          if (!res) {
            finishError('Não foi possível executar a extração na página.');
            return;
          }
          if (!res.success) {
            finishError(res.error || 'Falha desconhecida na extração.');
            return;
          }

          lastResult = res;
          downloadSession(res);
          setStatus('✅ Sessão extraída com sucesso!', 'success');
          actions.hidden = false;

          const v = res.meta && res.meta.waWebVersion;
          versionLine.textContent = v
            ? `Versão do WhatsApp Web: ${v}`
            : 'Versão do WhatsApp Web: não detectada';
          versionLine.hidden = false;
        }
      );
    });
  });

  copyBtn.addEventListener('click', async () => {
    if (!lastResult) return;
    try {
      await navigator.clipboard.writeText(lastResult.json);
      setStatus('📋 JSON copiado para a área de transferência!', 'success');
    } catch (e) {
      setStatus('❌ Não foi possível copiar: ' + e.message, 'error');
    }
  });

  downloadBtn.addEventListener('click', () => {
    if (lastResult) downloadSession(lastResult);
  });

  function finishError(msg) {
    loader.style.display = 'none';
    extractBtn.disabled = false;
    setStatus('❌ ' + msg, 'error');
  }
});

// Dispara o download do JSON a partir do popup (centraliza a lógica de saída).
function downloadSession(res) {
  const blob = new Blob([res.json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = res.filename || 'wa-session.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function setStatus(msg, type = 'info') {
  const status = document.getElementById('status');
  status.textContent = msg;
  status.className = 'status status-' + type;
}

// ---------------------------------------------------------------------------
// Função injetada na página (mundo MAIN). Não pode usar APIs `chrome`.
// Retorna sempre { success, ... } para que o popup mostre a causa real de erros.
// ---------------------------------------------------------------------------
function extractWhatsAppSession() {
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

    // Detecção best-effort da versão do WhatsApp Web (multi-fonte, com fallback null).
    const detectWaVersion = () => {
      const semver = /\d+\.\d+\.\d+(?:\.\d+)?/;
      try {
        const v = window.Debug && window.Debug.VERSION;
        if (v && semver.test(String(v))) return String(v).match(semver)[0];
      } catch { /* ignore */ }
      try {
        const meta = document.querySelector('meta[name="version"]');
        if (meta && meta.content && semver.test(meta.content)) return meta.content.match(semver)[0];
      } catch { /* ignore */ }
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k || !/version/i.test(k)) continue;
          const val = localStorage.getItem(k) || '';
          const m = val.match(semver);
          if (m) return m[0];
        }
      } catch { /* ignore */ }
      return null;
    };

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

      const waWebVersion = detectWaVersion();

      const out = {
        noiseCandidates, identityKey, registrationId,
        advSecretKey: noise.recoveryToken ?? null,
        account, id, lid, platform: 'android',
        _meta: {
          waWebVersion,
          extractedAt: new Date().toISOString(),
          userAgent: navigator.userAgent,
          extractorVersion: '1.1',
        },
        _raw: { lastWidMd: ls('last-wid-md'), waLid: ls('WALid') },
      };

      const json = JSON.stringify(out, null, 2);
      const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15); // YYYYMMDD-HHmmss-ish
      const filename = `wa-session-${stamp.slice(0, 8)}-${stamp.slice(8)}.json`;

      console.log('%c[extract] OK', 'color:green;font-weight:bold',
        { noiseCandidates: noiseCandidates.length, id, lid, registrationId, waWebVersion });

      return { success: true, json, filename, meta: out._meta };
    } catch (error) {
      console.error('[extract] erro:', error);
      return { success: false, error: String(error && error.message ? error.message : error) };
    }
  })();
}
