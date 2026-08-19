import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const dynamic = 'force-dynamic';

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const host = searchParams.get('host');
        const period = searchParams.get('period') || 'day'; // hour, day, week, month
        
        if (!host) {
            return NextResponse.json({ success: false, error: 'Host is required' });
        }

        let limit = 30;
        if (period === 'hour') limit = 24;
        else if (period === 'day') limit = 30;
        else if (period === 'week') limit = 12;
        else if (period === 'month') limit = 12;

        const { data: trendRows, error } = await supabase
            .rpc('get_server_period_trends', { p_host: host, p_period: period, p_limit: limit, p_timezone: 'Europe/Paris' });
            
        if (error) {
            return NextResponse.json({ success: false, error: error.message });
        }
        
        if (!trendRows || trendRows.length === 0) {
            return NextResponse.json({ success: true, host, period, trends: [] });
        }

        const trends = [];
        
        // We start at index 1 because index 0 is just the reference period for the first diff calculation
        for (let i = 1; i < trendRows.length; i++) {
            const current = trendRows[i];
            const previous = trendRows[i - 1];
            
            let trendPercent = 0;
            if (previous.avg_players > 0) {
                trendPercent = ((current.avg_players - previous.avg_players) / previous.avg_players) * 100;
            } else if (current.avg_players > 0) {
                trendPercent = 100;
            }

            const dateObj = new Date(current.period_date);
            let timeLabel = '';
            
            if (period === 'hour') {
                timeLabel = `${dateObj.getHours()}h`;
            } else if (period === 'day') {
                timeLabel = `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')}`;
            } else if (period === 'week') {
                timeLabel = `W${getWeekNumber(dateObj)}`;
            } else if (period === 'month') {
                timeLabel = dateObj.toLocaleString('en-US', { month: 'short' });
            }

            trends.push({
                timeLabel,
                fullDate: current.period_date,
                avgPlayers: current.avg_players,
                trendPercent: parseFloat(trendPercent.toFixed(1))
            });
        }
        
        return NextResponse.json({ 
            success: true, 
            host,
            period,
            trends
        });
    } catch (err) {
        console.error("Server Trends Error:", err);
        return NextResponse.json({ success: false, error: err.message, stack: err.stack });
    }
}

// Helper to get ISO week number
function getWeekNumber(d) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
    return Math.ceil((((date - yearStart) / 86400000) + 1)/7);
}
