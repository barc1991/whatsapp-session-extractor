# WhatsApp Session Extractor

Extensão de navegador (Chrome/Edge, Manifest V3) que extrai a sessão autenticada do
**WhatsApp Web** e a exporta como `wa-session.json`, pronto para ser importado em
bibliotecas não-oficiais como o **[Baileys](https://github.com/WhiskeySockets/Baileys)**.

> Browser extension (Chrome/Edge, Manifest V3) that extracts the authenticated
> **WhatsApp Web** session and exports it as `wa-session.json`, ready to import into
> unofficial libraries such as **Baileys**.

---

## 🇧🇷 Português

### Por que isso existe?

Bibliotecas não-oficiais (Baileys e similares) autenticam pareando um dispositivo via
**QR code**. Esse fluxo ficou instável: muitos usuários simplesmente **não conseguem
concluir o pareamento** lendo o QR — a conexão cai ou nunca completa.

A alternativa é usar o **WhatsApp Web oficial** (que faz o pareamento normalmente),
**extrair a sessão já autenticada** e reaproveitá-la na sua biblioteca. É exatamente
isso que esta extensão faz.

### Como funciona

O WhatsApp Web guarda o material criptográfico da sessão no `localStorage` e no
`IndexedDB` do navegador. A extensão:

1. Lê as chaves de `localStorage` (`WANoiseInfo`, `WAWebEncKeySalt`, `WANoiseInfoIv`,
   `last-wid-md`, `WALid`) e os registros do `IndexedDB` (`wawc_db_enc`, `signal-storage`).
2. **Decripta** o par de chaves Noise (AES-CBC via HKDF) e a identidade estática Signal
   (AES-CTR), além de ler o `adv_signed_identity` e o `registration id`.
3. Monta um JSON no formato de credenciais aceito pelo Baileys e dispara o download.

Tudo roda **localmente no seu navegador** — nada é enviado para nenhum servidor.

### Instalação

1. Baixe/clone este repositório.
2. Abra `chrome://extensions` (ou `edge://extensions`).
3. Ative o **Modo do desenvolvedor**.
4. Clique em **Carregar sem compactação** e selecione a pasta do projeto.

### Uso

1. Abra `https://web.whatsapp.com` e **faça login** (leia o QR uma vez pelo app oficial).
2. Clique no ícone da extensão. O popup deve mostrar **"✅ WhatsApp Web detectado"**.
3. Clique em **Extrair sessão**.
4. O arquivo `wa-session-AAAAMMDD-HHMMSS.json` é baixado automaticamente. Você também pode
   usar **📋 Copiar JSON** para colá-lo direto onde precisar.
5. O popup exibe a **versão do WhatsApp Web** detectada.

### Importar no Baileys

Os campos do JSON correspondem às credenciais do Baileys. Exemplo simplificado:

```js
const session = require('./wa-session.json');

// O Baileys usa UMA das chaves Noise; teste os candidatos até conectar.
const creds = {
  noiseKey:        session.noiseCandidates[0], // { private, public } (base64)
  signedIdentityKey: session.identityKey,      // { private, public } (base64)
  registrationId:  session.registrationId,
  advSecretKey:    session.advSecretKey,
  account:         session.account,
  me:              { id: session.id, lid: session.lid },
  platform:        session.platform,
  // ...complete com os demais campos exigidos pela sua versão do Baileys
};
```

> Observação: o WhatsApp Web pode gerar **vários candidatos de chave Noise**
> (`noiseCandidates`). Apenas um é o correto — a implementação do lado do cliente
> (ex.: whatsmeow/Baileys) valida o par `private → public`. Se o primeiro não conectar,
> tente os outros.

### Estrutura do JSON

| Campo               | Descrição                                                        |
| ------------------- | ---------------------------------------------------------------- |
| `noiseCandidates`   | Lista de pares Noise `{ private, public }` candidatos (base64).  |
| `identityKey`       | Identidade estática Signal `{ private, public }` (base64).       |
| `registrationId`    | ID de registro do dispositivo (número).                          |
| `advSecretKey`      | Token de recuperação ADV, se disponível.                         |
| `account`           | `details`, `accountSignatureKey`, `accountSignature`, `deviceSignature`. |
| `id` / `lid`        | JIDs do dispositivo companheiro.                                 |
| `platform`          | Plataforma reportada (`android`).                                |
| `_meta.waWebVersion`| **Versão detectada do WhatsApp Web** (ou `null`).                |
| `_meta.extractedAt` | Data/hora da extração (ISO 8601).                                |
| `_meta.userAgent`   | User-Agent do navegador usado.                                   |
| `_raw`              | Valores brutos de `last-wid-md` e `WALid` (para depuração).      |

### ⚠️ Segurança

O `wa-session.json` contém as **credenciais completas** da sua conta do WhatsApp —
qualquer pessoa com esse arquivo pode se passar por você. **Trate como uma senha:**

- Não faça commit dele em repositórios.
- Não envie por chat, e-mail ou serviços de terceiros.
- Apague depois de importar.

### Aviso legal

Ferramenta **não-oficial**, sem vínculo com o WhatsApp/Meta. O uso de bibliotecas
não-oficiais pode violar os Termos de Serviço do WhatsApp e resultar em banimento.
Use por sua conta e risco, apenas em contas que você controla.

---

## 🇺🇸 English

### Why does this exist?

Unofficial libraries (Baileys and similar) authenticate by pairing a device via
**QR code**. That flow became unreliable: many users **simply can't finish pairing**
by scanning the QR — the connection drops or never completes.

The workaround is to use the **official WhatsApp Web** (which pairs normally),
**extract the already-authenticated session**, and reuse it in your library. That's
exactly what this extension does.

### How it works

WhatsApp Web stores the session's cryptographic material in the browser's
`localStorage` and `IndexedDB`. The extension:

1. Reads keys from `localStorage` (`WANoiseInfo`, `WAWebEncKeySalt`, `WANoiseInfoIv`,
   `last-wid-md`, `WALid`) and `IndexedDB` records (`wawc_db_enc`, `signal-storage`).
2. **Decrypts** the Noise key pair (AES-CBC via HKDF) and the Signal static identity
   (AES-CTR), plus reads `adv_signed_identity` and the `registration id`.
3. Builds a Baileys-compatible credentials JSON and triggers the download.

Everything runs **locally in your browser** — nothing is sent to any server.

### Install

1. Download/clone this repository.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the project folder.

### Usage

1. Open `https://web.whatsapp.com` and **log in** (scan the QR once with the official app).
2. Click the extension icon. The popup should show **"✅ WhatsApp Web detectado"**.
3. Click **Extrair sessão** (Extract session).
4. The file `wa-session-YYYYMMDD-HHMMSS.json` downloads automatically. You can also use
   **📋 Copiar JSON** to copy it directly.
5. The popup shows the detected **WhatsApp Web version**.

### Import into Baileys

The JSON fields map to Baileys credentials. Simplified example:

```js
const session = require('./wa-session.json');

// Baileys uses ONE of the Noise keys; try the candidates until it connects.
const creds = {
  noiseKey:        session.noiseCandidates[0], // { private, public } (base64)
  signedIdentityKey: session.identityKey,      // { private, public } (base64)
  registrationId:  session.registrationId,
  advSecretKey:    session.advSecretKey,
  account:         session.account,
  me:              { id: session.id, lid: session.lid },
  platform:        session.platform,
  // ...fill in the remaining fields your Baileys version requires
};
```

> Note: WhatsApp Web may produce **several Noise key candidates** (`noiseCandidates`).
> Only one is correct — the client implementation (e.g. whatsmeow/Baileys) validates the
> `private → public` pair. If the first doesn't connect, try the others.

### JSON structure

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

### ⚠️ Security

`wa-session.json` contains your WhatsApp account's **full credentials** — anyone with
that file can impersonate you. **Treat it like a password:**

- Do not commit it to repositories.
- Do not send it over chat, email, or third-party services.
- Delete it after importing.

### Disclaimer

**Unofficial** tool, not affiliated with WhatsApp/Meta. Using unofficial libraries may
violate WhatsApp's Terms of Service and lead to a ban. Use at your own risk, only on
accounts you control.
