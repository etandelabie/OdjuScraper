import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

let isScrapingMCPE = false;

export async function fetchMCPEServers() {
  const cachePath = path.join(process.cwd(), 'scraped_cache_mcpe.json');
  let cacheData = [];
  
  if (fs.existsSync(cachePath)) {
    try {
      const stats = fs.statSync(cachePath);
      const age = Date.now() - stats.mtimeMs;
      cacheData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      
      // Cache valide (5 minutes)
      if (age < 300000) {
        return cacheData;
      }
    } catch (e) {
      console.error("Erreur lecture cache MCPE:", e);
    }
  }
  
  if (!isScrapingMCPE) {
    isScrapingMCPE = true;
    const workerPath = path.join(process.cwd(), 'scripts', 'scraper_mcpe.js');
    
    exec(`node "${workerPath}"`, (error, stdout, stderr) => {
      isScrapingMCPE = false;
      if (error) {
        console.error(`Erreur scraper MCPE: ${error.message}`);
      }
    });
  }
  
  return cacheData;
}
