import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';
import util from 'minecraft-server-util';

export const maxDuration = 10; // Vercel hobby limit
export const dynamic = 'force-dynamic'; // Désactiver le cache

export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const pwd = searchParams.get('pwd');
    
    // Vérification du mot de passe
    if (pwd !== process.env.ADMIN_PASSWORD) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        console.log("Ping MCPE lancé par cron-job.org");
        // 1. Récupérer tous les serveurs MCPE de la BDD
        const { data: servers, error: fetchError } = await supabase
            .from('mcpe_servers')
            .select('*');
            
        if (fetchError) throw fetchError;
        
        // 2. Ping concurrent
        const start = Date.now();
        const pingPromises = servers.map(server => {
            const port = parseInt(server.port) || 19132;
            return util.statusBedrock(server.host, port, { timeout: 3000, enableSRV: true })
                .then(res => ({
                    ...server,
                    status: {
                        online: true,
                        players: res.players.online,
                        max: res.players.max,
                        motd: res.motd.clean,
                        ping: res.roundTripLatency || 0
                    }
                }))
                .catch(() => ({
                    ...server,
                    status: {
                        online: false,
                        players: 0,
                        max: 0
                    }
                }));
        });
        
        const updatedServers = await Promise.all(pingPromises);
        
        // 3. Update Supabase
        // Pour éviter de faire 100 requêtes, on utilise upsert en bulk
        const { error: upsertError } = await supabase
            .from('mcpe_servers')
            .upsert(updatedServers, { onConflict: 'host' });
            
        if (upsertError) throw upsertError;
        
        // 4. Calculer le total et enregistrer l'historique
        const totalPlayers = updatedServers.reduce((sum, s) => sum + (s.status?.players || 0), 0);
        
        // Créer un dictionnaire { "host": players } pour l'historique détaillé
        const serverData = {};
        updatedServers.forEach(s => {
            if (s.status?.players > 0) {
                serverData[s.host] = s.status.players;
            }
        });

        const { error: histError } = await supabase
            .from('mcpe_history')
            .insert({
                timestamp: new Date().toISOString(),
                total_players: totalPlayers,
                servers_count: updatedServers.length,
                server_data: serverData
            });
            
        if (histError) throw histError;
        
        const end = Date.now();
        
        return NextResponse.json({ 
            success: true, 
            message: `Pinged ${updatedServers.length} servers in ${end - start}ms`,
            totalPlayers
        });
        
    } catch (err) {
        console.error("Ping sync error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
