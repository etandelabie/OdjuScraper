import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

let isScraping = false;

/**
 * Lit le cache du scraper fantôme (Puppeteer).
 * Si le cache est vieux ou inexistant, lance le robot en arrière-plan sans bloquer l'API.
 */
export async function fetchCommunityServers() {
  const cachePath = path.join(process.cwd(), 'scraped_cache.json');
  let cacheData = [];

  if (fs.existsSync(cachePath)) {
    try {
      const stats = fs.statSync(cachePath);
      const age = Date.now() - stats.mtimeMs;
      cacheData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));

      // Si le cache a moins de 5 minutes (300000 ms), on le retourne direct
      if (age < 300000) {
        return cacheData;
      }
    } catch (e) {
      console.error("Erreur lecture cache:", e);
    }
  }

  // Si on arrive ici, le cache est vieux ou inexistant.
  // On lance le worker en arrière-plan SEULEMENT s'il n'est pas déjà en cours.
  if (!isScraping) {
    isScraping = true;
    const workerPath = path.join(process.cwd(), 'scripts', 'scraper_worker.js');

    // On lance node sur le script externe pour ne pas bloquer Next.js
    exec(`node "${workerPath}"`, (error, stdout, stderr) => {
      isScraping = false;
      if (error) {
        console.error("Erreur du robot scraper:", stderr);
      } else {
        console.log("Mise à jour du scraper fantôme terminée.");
      }
    });
  }

  // On retourne immédiatement les anciennes données (ou un tableau vide) pour ne pas faire lagger l'application
  return cacheData;
}
