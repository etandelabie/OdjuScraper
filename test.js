const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('raw_page.html', 'utf8');
const $ = cheerio.load(html);

// Cherchons des mots clés
let apiFound = false;
$('script').each((i, el) => {
    const content = $(el).html();
    if (content && (content.includes('api') || content.includes('server') || content.includes('fetch'))) {
        console.log(`Script ${i} length: ${content.length}`);
        if (content.length < 5000) {
            console.log(content);
        }
    }
});
