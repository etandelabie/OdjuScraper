import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';

export const dynamic = 'force-dynamic';

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const host = searchParams.get('host');
        
        if (!host) {
            return NextResponse.json({ success: false, error: 'Host is required' });
        }

        const hoursAgo = 24 * 30;
        const intervalMinutes = 30;
        const startTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();

        const { data: dailyDataRows, error: dailyError } = await supabase
            .rpc('get_server_daily_stats', { p_start_time: startTime, p_host: host, p_timezone: 'Europe/Paris' });
            
        if (dailyError) {
            return NextResponse.json({ success: false, error: dailyError.message });
        }
        
        const dailyArray = (dailyDataRows || []).map(ds => {
            return {
                date: ds.date_day,
                maxPlayers: ds.max_players,
                uptimePercent: ds.total_points > 0 ? Math.round((ds.uptime_points / ds.total_points) * 100) : 0
            };
        });
        
        // L'heure de pointe est maintenant calculée globalement par la base de données
        const averagePeakHour = (dailyDataRows && dailyDataRows.length > 0 && dailyDataRows[0].peak_hour != null) 
            ? dailyDataRows[0].peak_hour 
            : 0;
        
        return NextResponse.json({ 
            success: true, 
            host,
            dailyData: dailyArray,
            averagePeakHour
        });
    } catch (err) {
        console.error("Server Profile Error:", err);
        return NextResponse.json({ success: false, error: err.message, stack: err.stack });
    }
}
