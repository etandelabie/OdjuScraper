const puppeteer = require('puppeteer');
const { supabase } = require('../lib/supabaseNode');

async function scrapeMinecraftPocketServers(page, maxPages = 5) {
  let allServers = [];
  
  for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
    const url = pageNum === 1 
        ? 'https://minecraftpocket-servers.com/' 
        : `https://minecraftpocket-servers.com/servers/list/${pageNum}/`;
        
    try {
      console.log(`Scraping MCPE Page ${pageNum}...`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      const serversOnPage = await page.evaluate(() => {
        const rows = document.querySelectorAll('tr');
        return Array.from(rows).map(row => {
          const nameEl = row.querySelector('h3 a');
          if (!nameEl) return null;
          
          const name = nameEl.textContent.trim();
          
          const ipBtn = row.querySelector('.btn-server-ip');
          let host = '';
          let port = '19132';
          let country = 'unknown';
          
          if (ipBtn) {
            const flagSpan = ipBtn.querySelector('.flag-icon');
            if (flagSpan) {
                const classes = flagSpan.className.split(' ');
                const flagClass = classes.find(c => c.startsWith('flag-icon-') && c !== 'flag-icon-squared');
                if (flagClass) {
                    country = flagClass.replace('flag-icon-', '').toUpperCase();
                }
            }
            
            const fullText = ipBtn.textContent.trim();
            const parts = fullText.split('\n');
            const hostPort = parts[parts.length - 1].trim();
            if (hostPort.includes(':')) {
              const hp = hostPort.split(':');
              host = hp[0];
              port = hp[1];
            } else {
              host = hostPort;
            }
          }
          
          let players = 0;
          const btnGroup = row.querySelectorAll('.btn-light2');
          for (const btn of btnGroup) {
            const strong = btn.querySelector('strong');
            if (strong) {
              players = parseInt(strong.textContent.replace(/,/g, ''), 10) || 0;
              break;
            }
          }
          
          const tags = Array.from(row.querySelectorAll('.list-server-tags a')).map(a => a.textContent.trim().toLowerCase());
          
          const allowedModes = ['adventure', 'anarchy', 'battle royale', 'cops and robbers', 'creative', 'factions', 'guns', 'hunger games', 'minigames', 'modded', 'parkour', 'practice', 'prison', 'pvp', 'skyblock', 'smp', 'survival'];
          let gameModes = [];
          for (const t of tags) {
              if (allowedModes.includes(t)) {
                  gameModes.push(t === 'factions' ? 'faction' : t);
              }
          }
          if (gameModes.length === 0) gameModes = ['autre'];
          
          let logo = '';
          let banner = '';
          const imgEl = row.querySelector('.server-banner-wrap img');
          if (imgEl) banner = imgEl.src;
          
          return { name, host, port, players, tags, gameModes, country, banner, logo, type: 'MCPE' };
        }).filter(Boolean);
      });
      
      if (serversOnPage.length === 0) {
          console.log("Aucun serveur trouvé sur cette page, arrêt de la pagination.");
          break; // Stop if no servers found on page
      }
      
      allServers = allServers.concat(serversOnPage);
    } catch (error) {
      console.error(`Erreur sur minecraftpocket-servers page ${pageNum}:`, error);
      break; // Stop if page crashes
    }
  }
  
  // Filtrer les serveurs ayant le tag 'cross-play'
  return allServers.filter(s => !s.tags.includes('cross-play'));
}

(async () => {
  console.log("Démarrage du scraper MCPE en arrière-plan...");
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
    // Bloquer les images et CSS pour accélérer
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });

    let finalServers = await scrapeMinecraftPocketServers(page, 30);
    
    // 1. Fetch banned servers from Supabase
    const { data: bannedData, error: banError } = await supabase
        .from('mcpe_banned_servers')
        .select('host');
        
    if (banError) {
        console.error('Erreur lecture banlist depuis Supabase:', banError);
    } else if (bannedData) {
        const bannedHosts = bannedData.map(b => b.host.toLowerCase());
        finalServers = finalServers.filter(s => !bannedHosts.includes(s.host.toLowerCase()));
    }
    
    // 1.5 Auto-ban specific patterns
    const serversToBan = [];
    finalServers = finalServers.filter(s => {
        const hostLower = s.host.toLowerCase();
        if (hostLower.startsWith('bedrock.') || s.country === 'CN') {
            serversToBan.push({ host: s.host });
            return false;
        }
        return true;
    });
    
    if (serversToBan.length > 0) {
        await supabase.from('mcpe_banned_servers').upsert(serversToBan, { onConflict: 'host' });
        console.log(`Auto-banned ${serversToBan.length} invalid or cross-play servers.`);
    }
    
    // 2. Format servers for Supabase
    let dbServers = finalServers.map(s => ({
        host: s.host,
        name: s.name,
        port: s.port ? parseInt(s.port, 10) : 19132,
        logo: s.logo,
        banner: s.banner,
        country: s.country,
        game_modes: s.gameModes,
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
    
    // 3. Upsert into mcpe_servers table
    const { error: upsertError } = await supabase
        .from('mcpe_servers')
        .upsert(dbServers, { onConflict: 'host' });
        
    if (upsertError) {
        console.error('Erreur sauvegarde mcpe_servers Supabase:', upsertError);
    }
    
    // 4. L'historique (mcpe_history) n'est plus enregistré par ce script.
    // Il est désormais géré par l'API /api/mcpe/sync_ping en temps réel.
    
    console.log(`Scraping MCPE terminé : ${finalServers.length} vrais serveurs MCPE trouvés.`);
  } catch (error) {
    console.error("Erreur générale du scraper MCPE:", error);
  } finally {
    if (browser) await browser.close();
  }
})();
