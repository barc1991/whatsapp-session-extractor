chrome.runtime.onInstalled.addListener(() => {
  console.log('WhatsApp Session Extractor instalado');
});

// Ouvir mensagens do popup se necessário
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extract') {
    // A extração é feita via scripting API no popup
    sendResponse({status: 'ok'});
  }
});