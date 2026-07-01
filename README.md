# WhatsApp Session Extractor

> Extensão para Chrome que extrai dados de sessão do WhatsApp Web, contornando a necessidade do código de segurança de 6 dígitos.

[![GitHub](https://img.shields.io/badge/GitHub-Repositório-blue?style=for-the-badge&logo=github)](https://github.com/marcoscarraro/whatsapp-session-extractor)

## 🎯 Objetivo

Esta extensão resolve o problema do **código de segurança de 6 dígitos** que o WhatsApp Web está solicitando para conectar, permitindo extrair a sessão diretamente do navegador para usar em bibliotecas como:

- **Baileys** (whatsapp-web.js)
- **Evolution API**
- **Ticketz**
- **WWebJS**
- E outras bibliotecas baseadas no WhatsApp Web

## ⚠️ Aviso de Segurança

**ESTA FERRAMENTA EXTRAI DADOS SENSÍVEIS DA SUA SESSÃO!**

- 🔒 **Mantenha o arquivo `wa-session.json` em local seguro**
- 🚫 **NUNCA compartilhe com ninguém**
- ⚠️ **Use APENAS para migração de sessão**

## 📦 Instalação

### Passo 1: Baixar a Extensão

**Opção A - Download do ZIP:**
1. Acesse o [repositório](https://github.com/marcoscarraro/whatsapp-session-extractor)
2. Clique em **"Code"** → **"Download ZIP"**
3. Extraia o arquivo em uma pasta

**Opção B - Clonar:**
```bash
git clone https://github.com/marcoscarraro/whatsapp-session-extractor.git
```

### Passo 2: Instalar no Chrome

1. Abra o Chrome e digite: `chrome://extensions/`
2. Ative o **"Modo do desenvolvedor"** (canto superior direito)
3. Clique em **"Carregar sem compactação"**
4. Selecione a pasta da extensão
5. ✅ Pronto! A extensão está instalada

## 🚀 Como Usar

### Extrair a Sessão

1. **Abra o WhatsApp Web**: `https://web.whatsapp.com`
2. **Escaneie o QR Code** com seu WhatsApp
3. **Clique no ícone da extensão** (📱) na barra do Chrome
4. **Clique em "Extrair Sessão"**
5. **Aguarde** alguns segundos
6. O arquivo `wa-session.json` será baixado

## 🔧 Solução de Problemas

### "WhatsApp Web não detectado"
- Certifique-se de estar em `https://web.whatsapp.com`
- Aguarde o carregamento completo da página

### Não baixa o arquivo
- Verifique as permissões de download do Chrome
- Tente recarregar o WhatsApp Web (F5)

### Erro na extração
- Abra o console (F12) para ver o erro
- Verifique se está logado no WhatsApp

## 📂 Arquivo Gerado

O arquivo `wa-session.json` contém todas as credenciais necessárias para autenticar em bibliotecas WhatsApp, **sem precisar do código de segurança**.

## 🔒 Privacidade

- ✅ **Nenhum dado é enviado para servidores**
- ✅ **Tudo ocorre localmente no seu navegador**
- ✅ **Código aberto para auditoria**

## 📄 Licença

MIT License - Veja o arquivo [LICENSE](https://github.com/marcoscarraro/whatsapp-session-extractor/blob/main/LICENSE)

---

**⭐ Deixe uma estrela no GitHub se ajudou você!**

---

Feito para contornar a verificação de segurança do WhatsApp Web
