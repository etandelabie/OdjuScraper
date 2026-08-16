import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';

export const dynamic = 'force-dynamic';

export async function GET() {
    const { data: history, error } = await supabase
        .from('mcpe_history')
        .select('*')
        .order('timestamp', { ascending: true });
        
    if (error) {
        return NextResponse.json({ success: false, error: error.message });
    }
    
    // Convert total_players to totalPlayers and include server_data
    const formattedHistory = history.map(h => ({
        timestamp: h.timestamp,
        totalPlayers: h.total_players,
        serversCount: h.servers_count,
        serverData: h.server_data || {}
    }));
    
    return NextResponse.json({ success: true, history: formattedHistory });
}
