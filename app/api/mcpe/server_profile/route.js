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
        
        let sumPeakHours = 0;
        let countDays = 0;
        
        const dailyArray = (dailyDataRows || []).map(ds => {
            if (ds.peak_hour >= 0 && ds.max_players > 0) {
                sumPeakHours += ds.peak_hour;
                countDays++;
            }
            return {
                date: ds.date_day,
                maxPlayers: ds.max_players,
                uptimePercent: ds.total_points > 0 ? Math.round((ds.uptime_points / ds.total_points) * 100) : 0
            };
        });
        
        const averagePeakHour = countDays > 0 ? Math.round(sumPeakHours / countDays) : 0;
        
        const { data: history, error: historyError } = await supabase
            .rpc('get_mcpe_history_sampled', { start_time: startTime, interval_minutes: 30 });
            
        if (historyError) {
            console.error("History sampled error:", historyError.message);
        }
        
        let now = Date.now();

        const getAverageForPeriod = (startHoursAgo, endHoursAgo) => {
            const start = now - startHoursAgo * 60 * 60 * 1000;
            const end = now - endHoursAgo * 60 * 60 * 1000;
            let sum = 0;
            let count = 0;
            if (history) {
                history.forEach(point => {
                    const time = new Date(point.timestamp).getTime();
                    if (time >= start && time < end) {
                        sum += (point.server_data?.[host] || 0);
                        count++;
                    }
                });
            }
            return count > 0 ? sum / count : null;
        };
        
        const avgCurrent24h = getAverageForPeriod(24, 0);
        const avgPrevious24h = getAverageForPeriod(48, 24); 
        
        const avgCurrent7d = getAverageForPeriod(24*7, 0);
        const avgPrevious7d = getAverageForPeriod(24*14, 24*7); 
        
        return NextResponse.json({ 
            success: true, 
            host,
            dailyData: dailyArray,
            averagePeakHour,
            trends: {
                current24h: avgCurrent24h,
                yesterday: avgPrevious24h,
                current7d: avgCurrent7d,
                lastWeek: avgPrevious7d
            }
        });
    } catch (err) {
        console.error("Server Profile Error:", err);
        return NextResponse.json({ success: false, error: err.message, stack: err.stack });
    }
}
