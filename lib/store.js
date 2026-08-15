import fs from 'fs';
import path from 'path';

const STORE_PATH = path.join(process.cwd(), 'custom_servers.json');

/**
 * Initializes the store file if it doesn't exist
 */
function initStore() {
  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(STORE_PATH, JSON.stringify([]));
  }
}

/**
 * Gets the list of custom servers
 * @returns {Array<{host: string, port: number}>}
 */
export function getCustomServers() {
  initStore();
  const data = fs.readFileSync(STORE_PATH, 'utf-8');
  try {
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

/**
 * Adds a new custom server to the store
 * @param {string} host 
 * @param {number} port 
 */
export function addCustomServer(host, port = 5520) {
  const servers = getCustomServers();
  // Avoid duplicates
  if (!servers.find(s => s.host === host && s.port === port)) {
    servers.push({ host, port });
    fs.writeFileSync(STORE_PATH, JSON.stringify(servers, null, 2));
  }
}
