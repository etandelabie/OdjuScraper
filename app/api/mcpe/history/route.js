import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';

export const dynamic = 'force-dynamic';

export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') || '24h';
    
    let intervalMinutes = 5; // Default for 24h
    let hoursAgo = 24;
    
    if (period === '7d') {
        intervalMinutes = 60; // 1 point per hour
        hoursAgo = 24 * 7;
    } else if (period === '30d') {
        intervalMinutes = 240; // 1 point every 4 hours
        hoursAgo = 24 * 30;
    }
    
    // Calcul de la date de départ
    const startTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();

    const { data: history, error } = await supabase
        .rpc('get_mcpe_history_sampled', { start_time: startTime, interval_minutes: intervalMinutes });
        
    if (error) {
        return NextResponse.json({ success: false, error: error.message });
    }
    
    // Trier les résultats en ordre chronologique (l'API retourne parfois dans l'ordre aléatoire ou DESC selon l'index)
    history.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    // Convert total_players to totalPlayers and include server_data
    const formattedHistory = history.map(h => ({
        timestamp: h.timestamp,
        totalPlayers: h.total_players,
        serversCount: h.servers_count,
        serverData: h.server_data || {}
    }));
    
    return NextResponse.json({ success: true, history: formattedHistory });
}
