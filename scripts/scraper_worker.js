const puppeteer = require('puppeteer');
const { supabase } = require('../lib/supabaseNode');

async function scrapeSites() {
  let browser;
  try {
    browser = await puppeteer.launch({ headless: 'new' });
    
    // ==========================================
    // SITE 1 : hytale.game
    // ==========================================
    const page1 = await browser.newPage();
    await page1.setRequestInterception(true);
    page1.on('request', (req) => {
      if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) req.abort();
      else req.continue();
    });

    let site1Servers = [];
    try {
      await page1.goto('https://hytale.game/serveurs/', { waitUntil: 'networkidle2', timeout: 30000 });
      site1Servers = await page1.evaluate(() => {
        const results = [];
        const wrappers = document.querySelectorAll('.server-item-wrapper, [data-address]');
        wrappers.forEach(wrapper => {
           const name = wrapper.querySelector('h3')?.innerText || wrapper.getAttribute('data-title') || '';
           const address = wrapper.getAttribute('data-address');
           const playersStr = wrapper.getAttribute('data-players');
           if (address && name) {
               let host = address, port = 5520;
               if (address.includes(':')) {
                   const parts = address.split(':');
                   host = parts[0];
                   port = parseInt(parts[1]) || 5520;
               }
               results.push({
                   name, host, port,
                   players: parseInt(playersStr) || 0,
                   logo: wrapper.getAttribute('data-logo') || '',
                   banner: wrapper.getAttribute('data-banner') || '',
                   type: wrapper.getAttribute('data-type') || ''
               });
           }
        });
        return results;
      });
    } catch(e) { console.error("Erreur site 1:", e); }
    await page1.close();

    // ==========================================
    // SITE 2 : hytaleonlineservers.com
    // ==========================================
    const page2 = await browser.newPage();
    await page2.setRequestInterception(true);
    page2.on('request', (req) => {
      if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) req.abort();
      else req.continue();
    });

    let site2Servers = [];
    try {
      await page2.goto('https://hytaleonlineservers.com/', { waitUntil: 'networkidle2', timeout: 30000 });
      site2Servers = await page2.evaluate(() => {
        const results = [];
        const cards = document.querySelectorAll('.server-card-mini');
        cards.forEach(card => {
            const name = card.getAttribute('data-name');
            const players = parseInt(card.getAttribute('data-players')) || 0;
            
            let host = '';
            const btn = card.querySelector('button[onclick*="copyServerIP"]');
            if (btn) {
                const match = btn.getAttribute('onclick').match(/copyServerIP\('([^']+)'/);
                if (match) host = match[1];
            }
            
            if (host && name) {
                let port = 5520;
                if (host.includes(':')) {
                    const parts = host.split(':');
                    host = parts[0];
                    port = parseInt(parts[1]) || 5520;
                }
                const video = card.querySelector('video');
                const banner = video ? video.getAttribute('poster') : '';
                results.push({
                    name, host, port, players,
                    logo: banner, // Use banner as logo if missing
                    banner,
                    type: card.getAttribute('data-category') || ''
                });
            }
        });
        return results;
      });
    } catch(e) { console.error("Erreur site 2:", e); }
    await page2.close();

    // ==========================================
    // SITE 3 : hytale-servers.com
    // ==========================================
    const page3 = await browser.newPage();
    await page3.setRequestInterception(true);
    page3.on('request', (req) => {
      if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) req.abort();
      else req.continue();
    });

    let site3Servers = [];
    for (let p = 1; p <= 3; p++) {
      try {
        const url = p === 1 ? 'https://hytale-servers.com/' : `https://hytale-servers.com/page/${p}/`;
        await page3.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        const s3 = await page3.evaluate(() => {
          const results = [];
          const links = document.querySelectorAll('a[href^="/server/"]');
          const seenHrefs = new Set();
          
          links.forEach(link => {
              const href = link.getAttribute('href');
              if (seenHrefs.has(href)) return;
              seenHrefs.add(href);
              
              let card = link;
              for(let i=0; i<4; i++) { if(card.parentNode) card = card.parentNode; }
              
              const text = card.innerText;
              if (!text) return;

              let name = href.replace('/server/', '').replace(/-/g, ' ');
              const h2 = card.querySelector('h2, h3, h4');
              if (h2) name = h2.innerText.trim();
              
              let host = '';
              const copyMatch = text.match(/([a-zA-Z0-9\.\-]+\.[a-zA-Z]{2,})\s*\nCOPY/i);
              if (copyMatch) host = copyMatch[1];
              
              let players = 0;
              const playersMatch = text.match(/PLAYERS\s*\n\s*(\d+)/i);
              if (playersMatch) players = parseInt(playersMatch[1]);
              
              const img = card.querySelector('img');
              const logo = img ? img.src : '';
              
              if (host && name) {
                  let port = 5520;
                  if (host.includes(':')) {
                      const parts = host.split(':');
                      host = parts[0];
                      port = parseInt(parts[1]) || 5520;
                  }
                  results.push({ name, host, port, players, logo, banner: '' });
              }
          });
          return results;
        });
        
        if (s3.length === 0) break;
        site3Servers = site3Servers.concat(s3);
      } catch(e) { 
        console.error(`Erreur site 3 page ${p}:`, e); 
        break;
      }
    }
    await page3.close();

    // ==========================================
    // SITE 4 : top-serveurs.net
    // ==========================================
    const page4 = await browser.newPage();
    await page4.setRequestInterception(true);
    page4.on('request', (req) => {
      if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) req.abort();
      else req.continue();
    });

    let site4Servers = [];
    for (let p = 1; p <= 3; p++) {
      try {
        const url = p === 1 ? 'https://top-serveurs.net/hytale' : `https://top-serveurs.net/hytale?page=${p}`;
        await page4.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        const s4 = await page4.evaluate(() => {
          const results = [];
          const cards = document.querySelectorAll('div.server, article, .server-card');
          for (const c of cards) {
              const h3 = c.querySelector('h3, h2, h4, .server-title');
              if (!h3) continue;
              const name = h3.innerText.trim();
              
              let host = '';
              const btn = c.querySelector('[data-clipboard-text], .ip, .copy-ip');
              if (btn) host = btn.getAttribute('data-clipboard-text') || btn.innerText;
              else {
                  const text = c.innerText;
                  const match = text.match(/([a-zA-Z0-9\.\-]+\.[a-zA-Z]{2,})/);
                  if (match) host = match[1];
              }
              
              let players = 0;
              const text = c.innerText;
              const pMatch = text.match(/(\d+)\s*\/\s*\d+\s*Joueurs/i) || text.match(/(\d+)\s*Joueurs/i) || text.match(/Joueurs\s*(\d+)/i);
              if (pMatch) players = parseInt(pMatch[1]);
              
              const img = c.querySelector('img');
              const logo = img ? img.src : '';
              
              let port = 5520;
              if (host && host.includes(':')) {
                  const parts = host.split(':');
                  host = parts[0];
                  port = parseInt(parts[1]) || 5520;
              }
              
              results.push({ name, host, port, players, logo, banner: '' });
          }
          return results;
        });
        
        if (s4.length === 0) break;
        site4Servers = site4Servers.concat(s4);
      } catch(e) {
        console.error(`Erreur site 4 page ${p}:`, e);
        break;
      }
    }
    await page4.close();

    // ==========================================
    // MERGE & DEDUPLICATE
    // ==========================================
    const allServersMap = new Map();
    const nameToKeyMap = new Map();

    const mergeServer = (srv) => {
      let key = `${srv.host}:${srv.port}`;
      const lowerName = srv.name.toLowerCase().trim();
      
      if (!srv.host) {
         // Recherche souple : si un nom existant contient ce nom ou vice-versa
         let foundKey = null;
         for (const [existingName, existingKey] of nameToKeyMap.entries()) {
             if (existingName.includes(lowerName) || lowerName.includes(existingName)) {
                 foundKey = existingKey;
                 break;
             }
         }
         
         if (foundKey) {
             key = foundKey;
         } else {
             key = lowerName;
         }
      }
      
      nameToKeyMap.set(lowerName, key);
      
      if (allServersMap.has(key)) {
        const existing = allServersMap.get(key);
        existing.players = Math.max(existing.players || 0, srv.players || 0);
        if (!existing.logo && srv.logo) existing.logo = srv.logo;
        if (!existing.banner && srv.banner) existing.banner = srv.banner;
        if (!existing.host && srv.host) {
            existing.host = srv.host;
            existing.port = srv.port;
        }
      } else {
        allServersMap.set(key, srv);
      }
    };

    site1Servers.forEach(mergeServer);
    site2Servers.forEach(mergeServer);
    site3Servers.forEach(mergeServer);
    site4Servers.forEach(mergeServer);
    
    // Filtre pour ne garder que ceux qui ont au moins un host ou un nom
    const finalServers = Array.from(allServersMap.values()).filter(s => s.host || s.name);
    
    // Format servers for Supabase
    let dbServers = finalServers.map(s => ({
        host: s.host || s.name, // Use name as fallback primary key if host is missing
        name: s.name,
        port: s.port || 5520,
        logo: s.logo,
        banner: s.banner,
        status: { online: true, players: s.players, max: 0 },
        updated_at: new Date().toISOString()
    }));
    
    // Deduplicate by host to prevent Supabase ON CONFLICT error
    const uniqueHosts = new Set();
    dbServers = dbServers.filter(s => {
        if (uniqueHosts.has(s.host)) return false;
        uniqueHosts.add(s.host);
        return true;
    });
    
    // Upsert into hytale_servers table
    const { error: upsertError } = await supabase
        .from('hytale_servers')
        .upsert(dbServers, { onConflict: 'host' });
        
    if (upsertError) {
        console.error('Erreur sauvegarde hytale_servers Supabase:', upsertError);
    }
    
    // Save history
    const totalPlayers = finalServers.reduce((sum, srv) => sum + (srv.players || 0), 0);
    const { error: historyError } = await supabase
        .from('hytale_history')
        .insert([{
            timestamp: new Date().toISOString(),
            total_players: totalPlayers,
            servers_count: finalServers.length
        }]);
        
    if (historyError) {
        console.error('Erreur sauvegarde hytale_history Supabase:', historyError);
    }
    
    console.log(`Scraping terminé : ${finalServers.length} serveurs uniques trouvés au total.`);
  } catch (error) {
    console.error("Erreur générale du scraper:", error);
  } finally {
    if (browser) await browser.close();
  }
}

scrapeSites();
