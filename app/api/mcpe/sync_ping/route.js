import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';
import util from 'minecraft-server-util';

export const maxDuration = 60; // Vercel hobby limit extended
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

        // 1. Récupérer la liste des bannis
        const { data: bannedData } = await supabase.from('mcpe_banned_servers').select('host');
        const bannedHosts = bannedData ? bannedData.map(b => b.host.toLowerCase()) : [];

        // 2. Récupérer tous les serveurs MCPE de la BDD
        const { data: servers, error: fetchError } = await supabase
            .from('mcpe_servers')
            .select('*');

        if (fetchError) throw fetchError;

        // 3. Filtrer les serveurs bannis (qui auraient pu être insérés par erreur) et auto-bannir les serveurs bedrock.* et CN
        const serversToBan = [];
        const validServers = servers.filter(s => {
            const hostLower = s.host.toLowerCase();
            if (bannedHosts.includes(hostLower)) return false;

            // Auto-ban
            if (hostLower.startsWith('bedrock.') || s.country === 'CN') {
                serversToBan.push({ host: s.host });
                return false;
            }
            return true;
        });

        // Appliquer les auto-bans si trouvés et les supprimer de la table active
        if (serversToBan.length > 0) {
            await supabase.from('mcpe_banned_servers').upsert(serversToBan, { onConflict: 'host' });
            for (const b of serversToBan) {
                await supabase.from('mcpe_servers').delete().eq('host', b.host);
            }
        }

        // 4. Ping par paquets (chunks) pour éviter de saturer le réseau de Vercel (UDP packet drop)
        const start = Date.now();
        const chunkSize = 30;
        let updatedServers = [];

        for (let i = 0; i < validServers.length; i += chunkSize) {
            const chunk = validServers.slice(i, i + chunkSize);
            const pingPromises = chunk.map(server => {
                const port = parseInt(server.port) || 19132;
                return util.statusBedrock(server.host, port, { timeout: 3000, enableSRV: true })
                    .then(res => {
                        const oldRecord = server.status?.record_players || 0;
                        const currentPlayers = res.players.online;
                        const isNewRecord = currentPlayers > oldRecord;

                        return {
                            host: server.host,
                            status: {
                                online: true,
                                players: currentPlayers,
                                max: res.players.max,
                                motd: res.motd.clean,
                                ping: res.roundTripLatency || 0,
                                record_players: isNewRecord ? currentPlayers : oldRecord,
                                record_timestamp: isNewRecord ? new Date().toISOString() : (server.status?.record_timestamp || new Date().toISOString())
                            },
                            is_affiliated: server.is_affiliated // keep it for the total calculation later
                        };
                    })
                    .catch(() => ({
                        host: server.host,
                        status: {
                            online: false,
                            players: 0,
                            max: 0,
                            record_players: server.status?.record_players || 0,
                            record_timestamp: server.status?.record_timestamp || new Date().toISOString()
                        },
                        is_affiliated: server.is_affiliated
                    }));
            });
            const chunkResults = await Promise.all(pingPromises);
            updatedServers.push(...chunkResults);
        }

        // 3. Update Supabase
        // Pour éviter de faire 100 requêtes, on utilise upsert en bulk.
        // On re-vérifie les serveurs qui existent encore pour ne pas ressusciter ceux supprimés (bannis) pendant le ping.
        const { data: currentServers } = await supabase.from('mcpe_servers').select('host');
        const currentHosts = currentServers ? currentServers.map(s => s.host) : [];
        
        const finalUpsertList = updatedServers
            .filter(s => currentHosts.includes(s.host))
            .map(s => ({
                host: s.host,
                status: s.status,
                updated_at: new Date().toISOString()
            }));

        const { error: upsertError } = await supabase
            .from('mcpe_servers')
            .upsert(finalUpsertList, { onConflict: 'host' });

        if (upsertError) throw upsertError;

        // 4. Calculer le total et enregistrer l'historique (ignorer les affiliés pour les totaux)
        const nonAffiliatedServers = updatedServers.filter(s => !s.is_affiliated);
        const totalPlayers = nonAffiliatedServers.reduce((sum, s) => sum + (s.status?.players || 0), 0);

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
                servers_count: nonAffiliatedServers.length,
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
