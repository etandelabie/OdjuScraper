const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Intercepter les requêtes
  page.on('response', async (response) => {
    if (response.url().includes('api') || response.url().includes('json')) {
      try {
        const json = await response.json();
        console.log(`[API Intercepted] ${response.url()} :`, JSON.stringify(json).substring(0, 200));
      } catch (e) {}
    }
  });

  await page.goto('https://hytale.game/serveurs/', { waitUntil: 'networkidle2' });
  
  const servers = await page.evaluate(() => {
    // Essayer de trouver tous les blocs qui pourraient être des serveurs
    const results = [];
    document.querySelectorAll('*').forEach(el => {
      const text = el.innerText || '';
      if (text.includes('Hylterium') || text.includes('Elendra') || text.includes('AresRPG')) {
        if (text.length < 500 && text.length > 10) {
           results.push({
               tag: el.tagName,
               className: el.className,
               text: text.replace(/\n/g, ' | ')
           });
        }
      }
    });
    return results;
  });
  
  console.log(JSON.stringify(servers, null, 2));
  await browser.close();
})();
