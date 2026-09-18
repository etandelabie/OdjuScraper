const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.goto('https://minecraftpocket-servers.com/', { waitUntil: 'domcontentloaded' });
    const text = await page.evaluate(() => {
        const els = document.querySelectorAll('.pagination a');
        return Array.from(els).map(a => a.textContent).join(', ');
    });
    console.log("Pagination:", text);
    await browser.close();
})();
