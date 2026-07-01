// Service worker mínimo. A extração roda via chrome.scripting a partir do popup.
chrome.runtime.onInstalled.addListener(() => {
  console.log('WhatsApp Session Extractor instalado');
});
