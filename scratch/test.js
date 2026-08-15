const puppeteer = require('puppeteer');
(async () => {
    const b = await puppeteer.launch({headless:'new'});
    const p = await b.newPage();
    await p.goto('https://top-serveurs.net/hytale', {waitUntil:'networkidle2'});
    const data = await p.evaluate(() => {
        const results = [];
        // Find links to server pages
        const links = document.querySelectorAll('a[href^="https://top-serveurs.net/server/"]');
        for (const link of links) {
            results.push(link.href);
        }
        return results;
    });
    console.log(data);
    await b.close();
})();
