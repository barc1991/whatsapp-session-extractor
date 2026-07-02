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
  const tokenLine = document.getElementById('tokenLine');
  const tokenValue = document.getElementById('tokenValue');
  const copyTokenBtn = document.getElementById('copyTokenBtn');

  // Formato de exportação atualmente selecionado ('baileys' | 'ticketz').
  const getFormat = () =>
    document.querySelector('input[name="format"]:checked')?.value || 'baileys';

  // Ao trocar o formato após uma extração, regera o arquivo/exibição correspondente.
  document.querySelectorAll('input[name="format"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      if (lastResult) refreshFormat();
    });
  });

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
          // Um token novo por extração — usado na coluna `token` do Ticketz.
          lastResult.token = randomToken();
          refreshFormat();
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
    if (!lastResult?.current) return;
    try {
      await navigator.clipboard.writeText(lastResult.current.json);
      setStatus('📋 JSON copiado para a área de transferência!', 'success');
    } catch (e) {
      setStatus('❌ Não foi possível copiar: ' + e.message, 'error');
    }
  });

  copyTokenBtn.addEventListener('click', async () => {
    if (!lastResult?.token) return;
    try {
      await navigator.clipboard.writeText(lastResult.token);
      setStatus('📋 Token copiado para a área de transferência!', 'success');
    } catch (e) {
      setStatus('❌ Não foi possível copiar: ' + e.message, 'error');
    }
  });

  downloadBtn.addEventListener('click', () => {
    if (lastResult?.current) downloadSession(lastResult.current);
  });

  // Monta a saída para o formato selecionado, dispara o download e
  // atualiza a exibição do token (apenas relevante para o Ticketz).
  function refreshFormat() {
    if (!lastResult) return;
    if (getFormat() === 'ticketz') {
      const session = buildTicketzSession(lastResult.data);
      lastResult.current = {
        json: JSON.stringify(session, null, 2),
        filename: (lastResult.filename || 'wa-session.json')
          .replace(/\.json$/, '')
          .replace(/^wa-session/, 'ticketz-session') + '.json',
      };
      tokenValue.textContent = lastResult.token;
      tokenLine.hidden = false;
    } else {
      lastResult.current = { json: lastResult.json, filename: lastResult.filename };
      tokenLine.hidden = true;
    }
    downloadSession(lastResult.current);
  }

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

// Envelopa uma string base64 no formato Buffer que o Baileys/Ticketz espera.
function buf(b64) {
  return { type: 'Buffer', data: b64 };
}

// Prefixa a chave pública (base64) com o byte 0x05 do protocolo Signal e
// devolve novamente em base64 — usado no `identifierKey` de signalIdentities.
function signalPubKey(b64) {
  const raw = atob(b64);
  let out = String.fromCharCode(5);
  out += raw;
  return btoa(out);
}

// Gera um token alfanumérico de 30 caracteres (coluna `token` do Ticketz).
function randomToken(len = 30) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let s = '';
  for (const b of bytes) s += alphabet[b % alphabet.length];
  return s;
}

// Converte os dados extraídos para o JSON de sessão que o Ticketz importa:
// objeto { creds, keys } com as chaves binárias no formato Buffer.
// A ordem das chaves segue o padrão do Baileys/Ticketz para ficar idêntico.
// O WhatsApp Web pode expor vários candidatos de chave Noise; usamos o
// primeiro (o cliente valida o par private→public ao conectar).
//
// Campos de tempo de execução do Baileys que o WhatsApp Web não guarda
// (myAppStateKeyId, lastPropHash, lastAccountSyncTimestamp, routingInfo) saem
// com defaults válidos — o cliente os repopula sozinho ao conectar.
function buildTicketzSession(data) {
  const noise = (data.noiseCandidates && data.noiseCandidates[0]) || null;
  const sp = data.signedPreKey || null;
  const eph = data.pairingEphemeralKeyPair || null;

  const creds = {
    noiseKey: noise ? { private: buf(noise.private), public: buf(noise.public) } : null,
    pairingEphemeralKeyPair: eph
      ? { private: buf(eph.private), public: buf(eph.public) }
      : null,
    signedIdentityKey: {
      private: buf(data.identityKey.private),
      public: buf(data.identityKey.public),
    },
    signedPreKey: sp
      ? {
          keyPair: { private: buf(sp.private), public: buf(sp.public) },
          signature: buf(sp.signature),
          keyId: sp.keyId,
        }
      : null,
    registrationId: data.registrationId,
    advSecretKey: data.advSecretKey,
    processedHistoryMessages: [],
    nextPreKeyId: 1,
    firstUnuploadedPreKeyId: 1,
    accountSyncCounter: 0,
    accountSettings: { unarchiveChats: false },
    registered: true,
    account: {
      details: buf(data.account.details),
      accountSignatureKey: buf(data.account.accountSignatureKey),
      accountSignature: buf(data.account.accountSignature),
      deviceSignature: buf(data.account.deviceSignature),
    },
    me: { id: data.id, name: data.pushName ?? '', lid: data.lid ?? null },
    signalIdentities: data.lid
      ? [{
          identifier: { name: data.lid.replace('@s.whatsapp.net', '@lid'), deviceId: 0 },
          identifierKey: buf(signalPubKey(data.account.accountSignatureKey)),
        }]
      : [],
    platform: data.platform,
    routingInfo: data.routingInfo ? buf(data.routingInfo) : null,
    lastAccountSyncTimestamp: 0,
    myAppStateKeyId: null,
    reachoutTimeLock: { isActive: false, enforcementType: 'DEFAULT' },
    lastPropHash: null,
  };

  return { creds, keys: {} };
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

    const getAllRecords = (dbName, storeName) => new Promise((res, rej) => {
      const r = indexedDB.open(dbName);
      r.onerror = () => rej(r.error);
      r.onsuccess = () => {
        const db = r.result; const tx = db.transaction(storeName, 'readonly');
        const g = tx.objectStore(storeName).getAll();
        g.onsuccess = () => { db.close(); res(g.result || []); };
        g.onerror = () => { db.close(); rej(g.error); };
      };
    });

    // AES-CTR (contador zero) — mesmo esquema que o WhatsApp Web usa para os
    // campos privados guardados junto de um `encKey` (identidade estática, etc.).
    const decCtr = (encKey, valueBuf) => crypto.subtle.decrypt(
      { name: 'AES-CTR', counter: new Uint8Array(16), length: 64 }, encKey, valueBuf);

    // Devolve um campo do IndexedDB em base64, decriptando se vier no formato
    // { encKey, value }; caso contrário trata como bytes crus (públicos).
    const maybeField = async (f) => {
      if (f && f.encKey && f.value) return b64(await decCtr(f.encKey, f.value));
      return b64(f);
    };

    // Gera um par efêmero X25519 (pairingEphemeralKeyPair). Só precisa existir e
    // ser bem-tipado — não é usado após o pareamento. Fallback: bytes aleatórios.
    const genX25519 = async () => {
      try {
        const kp = await crypto.subtle.generateKey({ name: 'X25519' }, true, ['deriveBits']);
        const pub = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
        const pk8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', kp.privateKey));
        return { private: b64(pk8.slice(pk8.length - 32)), public: b64(pub) };
      } catch {
        return {
          private: b64(crypto.getRandomValues(new Uint8Array(32))),
          public: b64(crypto.getRandomValues(new Uint8Array(32))),
        };
      }
    };

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
        const pt = await decCtr(rec.value.encKey, rec.value.value);
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

      // ---- Signed pre-key (signal-storage/signed-prekey-store) ----
      // Registro { keyId, keyPair:{pubKey,privKey}, signature }. Campos privados
      // podem vir cifrados ({encKey,value}) ou crus — maybeField trata os dois.
      let signedPreKey = null;
      try {
        const recs = await getAllRecords('signal-storage', 'signed-prekey-store');
        const rec = recs.length
          ? recs.reduce((a, b) => (Number(b.keyId) > Number(a.keyId) ? b : a))
          : null;
        if (rec && rec.keyPair) {
          signedPreKey = {
            keyId: Number(rec.keyId),
            private: await maybeField(rec.keyPair.privKey),
            public: await maybeField(rec.keyPair.pubKey),
            signature: await maybeField(rec.signature),
          };
          const privLen = fromB64(signedPreKey.private).length;
          const sigLen = fromB64(signedPreKey.signature).length;
          console.log('[extract] signedPreKey', { keyId: signedPreKey.keyId, privLen, sigLen });
          if (privLen !== 32) console.warn('[extract] signedPreKey.private len inesperado:', privLen);
          if (sigLen !== 64) console.warn('[extract] signedPreKey.signature len inesperado:', sigLen);
        } else {
          console.warn('[extract] signed-prekey-store vazio');
        }
      } catch (e) {
        console.warn('[extract] falha ao ler signed-prekey-store:', e);
      }

      // ---- Par efêmero de pareamento (gerado; não persistido pelo WA Web) ----
      const pairingEphemeralKeyPair = await genX25519();

      // ---- Push name (model-storage/contact do próprio JID), best-effort ----
      let pushName = null;
      try {
        const own = await getRecord('model-storage', 'contact', id);
        pushName = (own && (own.pushname || own.name)) || null;
      } catch { /* sem contato próprio */ }

      // ---- Routing info (localStorage, chave incerta), best-effort ----
      // Campo opcional no Baileys; só usamos se o valor já parecer base64,
      // para não arriscar dupla codificação. Senão fica null.
      let routingInfo = null;
      try {
        const isB64 = (s) => /^[A-Za-z0-9+/]{2,}={0,2}$/.test(s);
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && /rout/i.test(k)) {
            const raw = (ls(k) || '').trim();
            if (raw && isB64(raw)) { routingInfo = raw; break; }
          }
        }
      } catch { /* ignore */ }

      const waWebVersion = detectWaVersion();

      const out = {
        noiseCandidates, identityKey, registrationId,
        advSecretKey: noise.recoveryToken ?? null,
        account, id, lid, platform: 'android',
        signedPreKey, pairingEphemeralKeyPair, pushName, routingInfo,
        _meta: {
          waWebVersion,
          extractedAt: new Date().toISOString(),
          userAgent: navigator.userAgent,
          extractorVersion: '1.2',
        },
        _raw: { lastWidMd: ls('last-wid-md'), waLid: ls('WALid') },
      };

      const json = JSON.stringify(out, null, 2);
      const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15); // YYYYMMDD-HHmmss-ish
      const filename = `wa-session-${stamp.slice(0, 8)}-${stamp.slice(8)}.json`;

      console.log('%c[extract] OK', 'color:green;font-weight:bold',
        { noiseCandidates: noiseCandidates.length, id, lid, registrationId, waWebVersion,
          signedPreKey: !!signedPreKey, pushName, routingInfo: !!routingInfo });

      return { success: true, json, filename, meta: out._meta, data: out };
    } catch (error) {
      console.error('[extract] erro:', error);
      return { success: false, error: String(error && error.message ? error.message : error) };
    }
  })();
}
