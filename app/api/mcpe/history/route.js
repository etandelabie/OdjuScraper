import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';

export async function GET() {
    const { data: history, error } = await supabase
        .from('mcpe_history')
        .select('*')
        .order('timestamp', { ascending: true });
        
    if (error) {
        return NextResponse.json({ success: false, error: error.message });
    }
    
    // Convert total_players to totalPlayers
    const formattedHistory = history.map(h => ({
        timestamp: h.timestamp,
        totalPlayers: h.total_players,
        serversCount: h.servers_count
    }));
    
    return NextResponse.json({ success: true, history: formattedHistory });
}
