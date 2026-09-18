const https = require('https');

https.get('https://odju-scraper-rho.vercel.app/api/mcpe/sync_ping?pwd=noxi69', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(res.headers, null, 2)}`);
    console.log(`BODY: ${data}`);
  });
}).on('error', (e) => {
  console.error(e);
});
