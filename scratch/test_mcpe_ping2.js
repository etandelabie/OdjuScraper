const util = require('minecraft-server-util');
const { supabase } = require('../lib/supabaseNode');

async function testConcurrentPing() {
    console.log("Récupération de tous les serveurs MCPE...");
    const { data: servers } = await supabase.from('mcpe_servers').select('host, port');
    console.log(`${servers.length} serveurs trouvés. Début du ping concurrent...`);

    const start = Date.now();
    const promises = servers.map(server => {
        const port = parseInt(server.port) || 19132;
        return util.statusBedrock(server.host, port, { timeout: 3000, enableSRV: true })
            .then(res => ({ host: server.host, online: true, players: res.players.online }))
            .catch(() => ({ host: server.host, online: false }));
    });

    const results = await Promise.all(promises);
    const end = Date.now();
    
    const online = results.filter(r => r.online).length;
    console.log(`Fini en ${end - start}ms. ${online}/${servers.length} en ligne.`);
}

testConcurrentPing();
