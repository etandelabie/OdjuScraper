import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';

export const dynamic = 'force-dynamic';

export async function GET() {
    // 1. Get servers
    const { data: servers, error } = await supabase
        .from('mcpe_servers')
        .select('*');
        
    if (error) {
        return NextResponse.json({ success: false, error: error.message });
    }
    
    // Convert game_modes array back to camelCase for the frontend (gameModes)
    const formattedServers = servers.map(s => ({
        ...s,
        gameModes: s.game_modes,
        players: s.status?.players || 0
    }));
    
    // Sort by players
    formattedServers.sort((a, b) => b.players - a.players);
    
    const totalPlayers = formattedServers.reduce((sum, srv) => sum + srv.players, 0);
    // Fetch last history entry to get precise lastUpdated time
    const { data: histData } = await supabase
        .from('mcpe_history')
        .select('timestamp')
        .order('timestamp', { ascending: false })
        .limit(1);
        
    const lastUpdated = histData && histData.length > 0 ? histData[0].timestamp : null;
    return NextResponse.json({ success: true, servers: formattedServers, totalPlayers, lastUpdated });
}
