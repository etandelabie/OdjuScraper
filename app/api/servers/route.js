import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabaseClient';

export async function GET() {
    const { data: servers, error } = await supabase
        .from('hytale_servers')
        .select('*');
        
    if (error) {
        return NextResponse.json({ success: false, error: error.message });
    }
    
    // Sort locally by players to match previous behavior, or if they were sorted?
    // Let's sort by players descending
    servers.sort((a, b) => (b.status?.players || 0) - (a.status?.players || 0));
    
    const totalPlayers = servers.reduce((sum, srv) => sum + (srv.status?.players || 0), 0);
    const lastUpdated = servers.length > 0 ? servers[0].updated_at : null;
    
    return NextResponse.json({ success: true, servers, totalPlayers, lastUpdated });
}
