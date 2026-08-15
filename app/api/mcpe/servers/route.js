import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';

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
    const lastUpdated = formattedServers.length > 0 ? formattedServers[0].updated_at : null;
    
    return NextResponse.json({ success: true, servers: formattedServers, totalPlayers, lastUpdated });
}
