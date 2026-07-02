# WhatsApp Session Extractor

> Extensão para Chrome/Edge (Manifest V3) que extrai a sessão autenticada do WhatsApp Web e a exporta como `wa-session.json`, para usar em bibliotecas como o Baileys — sem depender da leitura do QR code / código de 6 dígitos.

[![GitHub](https://img.shields.io/badge/GitHub-Repositório-blue?style=for-the-badge&logo=github)](https://github.com/marcoscarraro/whatsapp-session-extractor)

---

## 🇧🇷 Português

### 🎯 Objetivo

Bibliotecas não-oficiais (Baileys e similares) autenticam pareando um dispositivo via **QR code / código de segurança**. Esse fluxo ficou instável e muitos usuários **não conseguem concluir o pareamento**.

A alternativa é usar o **WhatsApp Web oficial** (que pareia normalmente), **extrair a sessão já autenticada** e reaproveitá-la na sua biblioteca. É isso que esta extensão faz. Funciona com:

- **Baileys**
- **Evolution API**
- **Ticketz**
- **whatsapp-web.js (WWebJS)**
- Outras bibliotecas baseadas no WhatsApp Web

### ⚙️ Como funciona

O WhatsApp Web guarda o material criptográfico da sessão no `localStorage` e no `IndexedDB` do navegador. A extensão:

1. Lê as chaves de `localStorage` (`WANoiseInfo`, `WAWebEncKeySalt`, `WANoiseInfoIv`, `last-wid-md`, `WALid`) e os registros do `IndexedDB` (`wawc_db_enc`, `signal-storage`).
2. **Decripta** o par de chaves Noise (AES-CBC via HKDF) e a identidade estática Signal (AES-CTR), além de ler o `adv_signed_identity` e o `registration id`.
3. Monta um JSON no formato de credenciais aceito pelo Baileys e dispara o download.

Tudo roda **localmente no seu navegador** — nenhum dado é enviado para servidores.

### ⚠️ Aviso de Segurança

**ESTA FERRAMENTA EXTRAI AS CREDENCIAIS COMPLETAS DA SUA CONTA!** Qualquer pessoa com o `wa-session.json` pode se passar por você. Trate como uma senha:

- 🔒 **Mantenha o arquivo em local seguro**
- 🚫 **NUNCA compartilhe com ninguém** (chat, e-mail, serviços de terceiros)
- 🧹 **Apague depois de importar** e não faça commit dele em repositórios

### 📦 Instalação

**Opção A – Download do ZIP:**
1. Acesse o [repositório](https://github.com/marcoscarraro/whatsapp-session-extractor)
2. Clique em **"Code"** → **"Download ZIP"** e extraia em uma pasta

**Opção B – Clonar:**
```bash
git clone https://github.com/marcoscarraro/whatsapp-session-extractor.git
```

**Instalar no navegador:**
1. Abra `chrome://extensions/` (ou `edge://extensions/`)
2. Ative o **"Modo do desenvolvedor"** (canto superior direito)
3. Clique em **"Carregar sem compactação"** e selecione a pasta da extensão
4. ✅ Pronto!

### 🚀 Como Usar

1. **Abra o WhatsApp Web** em `https://web.whatsapp.com` e **faça login** (leia o QR uma vez pelo app oficial)
2. **Clique no ícone da extensão** (🔐) na barra do navegador — o popup deve mostrar **"✅ WhatsApp Web detectado"**
3. **Clique em "Extrair sessão"**
4. O arquivo `wa-session-AAAAMMDD-HHMMSS.json` será baixado automaticamente
5. Opcional: use **📋 Copiar JSON** para colar o conteúdo direto onde precisar
6. O popup exibe a **versão do WhatsApp Web** detectada

### 🔌 Importar no Baileys

Os campos do JSON correspondem às credenciais do Baileys. Exemplo simplificado:

```js
const session = require('./wa-session.json');

// O Baileys usa UMA das chaves Noise; teste os candidatos até conectar.
const creds = {
  noiseKey:          session.noiseCandidates[0], // { private, public } (base64)
  signedIdentityKey: session.identityKey,        // { private, public } (base64)
  registrationId:    session.registrationId,
  advSecretKey:      session.advSecretKey,
  account:           session.account,
  me:                { id: session.id, lid: session.lid },
  platform:          session.platform,
  // ...complete com os demais campos exigidos pela sua versão do Baileys
};
```

> O WhatsApp Web pode gerar **vários candidatos de chave Noise** (`noiseCandidates`). Só um é o correto — a implementação do cliente valida o par `private → public`. Se o primeiro não conectar, tente os outros.

### 🎫 Exportar para o Ticketz

Selecione o formato **Ticketz** antes de extrair (ou troque o formato depois da extração). A extensão gera:

- Um JSON no padrão que o Ticketz usa — objeto `{ "creds": { ... }, "keys": {} }` com as chaves binárias no formato `{ "type": "Buffer", "data": "<base64>" }` (o mesmo formato do Baileys). O arquivo baixado é `ticketz-session-AAAAMMDD-HHMMSS.json`.
- Um **token** alfanumérico de 30 caracteres (ex.: `zW1PGcsch29HlroKaPpYoYb0NvT7Dy`), exibido no popup com botão de copiar, para preencher a **coluna `token`** da conexão no Ticketz.

O JSON traz o **schema completo** do `creds` do Baileys (todas as chaves presentes):

- **Extraídos do WhatsApp Web:** `noiseKey`, `signedIdentityKey`, `signedPreKey` (par + assinatura + `keyId`), `account`, `registrationId`, `advSecretKey`, `signalIdentities`, `me.id`/`me.lid` e, quando disponíveis, `me.name` e `routingInfo`.
- **`pairingEphemeralKeyPair`** é gerado na hora (não é persistido pelo WhatsApp Web e não é usado após o pareamento — só precisa existir e estar bem-formado).
- **Defaults** para campos que são estado de execução do Baileys e o WhatsApp Web não guarda: `myAppStateKeyId` (`null`), `lastPropHash` (`null`), `lastAccountSyncTimestamp` (`0`), `reachoutTimeLock`, contadores de pre-key. O cliente os repopula ao conectar — não impedem a reconexão.

Para importar: grave o JSON na coluna `session` da conexão e o token na coluna `token`.

> Como no Baileys, quando há mais de um candidato de chave Noise a extensão usa o primeiro. Se a conexão não subir, extraia novamente ou ajuste `creds.noiseKey` para outro candidato.
>
> Se o Ticketz reclamar do `signedPreKey`, abra o console (F12) na página do WhatsApp e veja o log `[extract] signedPreKey` — ele mostra o tamanho da chave privada (esperado 32) e da assinatura (esperado 64).

### 📂 Estrutura do JSON gerado

| Campo                | Descrição                                                        |
| -------------------- | ---------------------------------------------------------------- |
| `noiseCandidates`    | Lista de pares Noise `{ private, public }` candidatos (base64).  |
| `identityKey`        | Identidade estática Signal `{ private, public }` (base64).       |
| `registrationId`     | ID de registro do dispositivo (número).                          |
| `advSecretKey`       | Token de recuperação ADV, se disponível.                         |
| `account`            | `details`, `accountSignatureKey`, `accountSignature`, `deviceSignature`. |
| `id` / `lid`         | JIDs do dispositivo companheiro.                                 |
| `platform`           | Plataforma reportada (`android`).                                |
| `_meta.waWebVersion` | **Versão detectada do WhatsApp Web** (ou `null`).                |
| `_meta.extractedAt`  | Data/hora da extração (ISO 8601).                                |
| `_meta.userAgent`    | User-Agent do navegador usado.                                   |
| `_raw`               | Valores brutos de `last-wid-md` e `WALid` (para depuração).      |

### 🔧 Solução de Problemas

- **"Abra o WhatsApp Web primeiro"** — verifique se a aba ativa é `https://web.whatsapp.com` e aguarde o carregamento.
- **Falha na extração** — confira a mensagem de erro no popup e abra o console (F12) na página do WhatsApp para detalhes; confirme que está logado.
- **Versão "não detectada"** — o WhatsApp muda as fontes entre releases. A extração continua funcionando; se quiser, abra o console e veja qual fonte de versão existe naquela build.

### 🔒 Privacidade

- ✅ Nenhum dado é enviado para servidores — tudo ocorre localmente
- ✅ Código aberto para auditoria

### 📄 Aviso legal

Ferramenta **não-oficial**, sem vínculo com o WhatsApp/Meta. O uso de bibliotecas não-oficiais pode violar os Termos de Serviço e resultar em banimento. Use por sua conta e risco, apenas em contas que você controla.

---

## 🇺🇸 English

### 🎯 Purpose

Unofficial libraries (Baileys and similar) authenticate by pairing a device via **QR code / security code**. That flow became unreliable and many users **can't finish pairing**.

The workaround is to use the **official WhatsApp Web** (which pairs normally), **extract the already-authenticated session**, and reuse it in your library. That's what this extension does. Works with **Baileys**, **Evolution API**, **Ticketz**, **whatsapp-web.js**, and other WhatsApp Web-based libraries.

### ⚙️ How it works

WhatsApp Web stores the session's cryptographic material in the browser's `localStorage` and `IndexedDB`. The extension reads those keys, **decrypts** the Noise key pair (AES-CBC via HKDF) and the Signal static identity (AES-CTR), reads `adv_signed_identity` and the `registration id`, then builds a Baileys-compatible JSON and downloads it. Everything runs **locally** — nothing is sent to any server.

### ⚠️ Security

`wa-session.json` contains your account's **full credentials** — anyone with it can impersonate you. Treat it like a password: keep it safe, **never share it**, and delete it after importing. Don't commit it to repositories.

### 📦 Install

1. Download/clone this repository.
2. Open `chrome://extensions/` (or `edge://extensions/`).
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the project folder.

### 🚀 Usage

1. Open `https://web.whatsapp.com` and **log in** (scan the QR once with the official app).
2. Click the extension icon (🔐) — the popup should show **"✅ WhatsApp Web detectado"**.
3. Click **Extrair sessão** (Extract session).
4. `wa-session-YYYYMMDD-HHMMSS.json` downloads automatically. You can also use **📋 Copiar JSON** to copy it.
5. The popup shows the detected **WhatsApp Web version**.

### 🔌 Import into Baileys

```js
const session = require('./wa-session.json');

// Baileys uses ONE of the Noise keys; try the candidates until it connects.
const creds = {
  noiseKey:          session.noiseCandidates[0], // { private, public } (base64)
  signedIdentityKey: session.identityKey,        // { private, public } (base64)
  registrationId:    session.registrationId,
  advSecretKey:      session.advSecretKey,
  account:           session.account,
  me:                { id: session.id, lid: session.lid },
  platform:          session.platform,
  // ...fill in the remaining fields your Baileys version requires
};
```

> WhatsApp Web may produce **several Noise key candidates** (`noiseCandidates`). Only one is correct — the client validates the `private → public` pair. If the first doesn't connect, try the others.

### 📂 JSON structure

| Field                | Description                                                      |
| -------------------- | ---------------------------------------------------------------- |
| `noiseCandidates`    | List of candidate Noise pairs `{ private, public }` (base64).    |
| `identityKey`        | Signal static identity `{ private, public }` (base64).           |
| `registrationId`     | Device registration ID (number).                                 |
| `advSecretKey`       | ADV recovery token, if available.                                |
| `account`            | `details`, `accountSignatureKey`, `accountSignature`, `deviceSignature`. |
| `id` / `lid`         | Companion device JIDs.                                           |
| `platform`           | Reported platform (`android`).                                   |
| `_meta.waWebVersion` | **Detected WhatsApp Web version** (or `null`).                   |
| `_meta.extractedAt`  | Extraction timestamp (ISO 8601).                                 |
| `_meta.userAgent`    | Browser User-Agent used.                                         |
| `_raw`               | Raw `last-wid-md` and `WALid` values (for debugging).            |

### 📄 Disclaimer

**Unofficial** tool, not affiliated with WhatsApp/Meta. Using unofficial libraries may violate WhatsApp's Terms of Service and lead to a ban. Use at your own risk, only on accounts you control.

---

## 📄 Licença / License

MIT License — veja o arquivo [LICENSE](https://github.com/marcoscarraro/whatsapp-session-extractor/blob/main/LICENSE).

**⭐ Deixe uma estrela no GitHub se ajudou você! / Star the repo if it helped!**
