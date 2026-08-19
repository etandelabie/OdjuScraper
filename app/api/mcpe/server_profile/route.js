import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';

export const dynamic = 'force-dynamic';

export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const host = searchParams.get('host');
    
    if (!host) {
        return NextResponse.json({ success: false, error: 'Host is required' });
    }

    // We fetch 30 days of data, sampled every 30 minutes to be accurate enough for daily peak but not too heavy
    const hoursAgo = 24 * 30;
    const intervalMinutes = 30;
    const startTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();

    const { data: history, error } = await supabase
        .rpc('get_server_history', { p_start_time: startTime, p_host: host });
        
    if (error) {
        return NextResponse.json({ success: false, error: error.message });
    }
    
    history.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    // Aggregate daily stats
    const dailyStats = {};
    
    let now = Date.now();
    
    history.forEach(point => {
        const players = point.players || 0;
        const date = new Date(point.timestamp);
        // Utiliser l'heure de Paris pour grouper correctement les jours (évite le décalage de minuit)
        const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
        
        if (!dailyStats[dayKey]) {
            dailyStats[dayKey] = {
                date: dayKey,
                maxPlayers: 0,
                uptimePoints: 0,
                totalPoints: 0
            };
        }
        
        dailyStats[dayKey].totalPoints++;
        if (players > dailyStats[dayKey].maxPlayers) {
            dailyStats[dayKey].maxPlayers = players;
        }
        if (players > 0) {
            dailyStats[dayKey].uptimePoints++;
        }
    });
    
    // Find the peak hour of each day
    const dailyHours = {}; // { 'YYYY-MM-DD': { 0: sum, 1: sum, ... } }
    history.forEach(point => {
        const players = point.players || 0;
        const date = new Date(point.timestamp);
        const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
        
        // Récupérer l'heure en locale (Paris)
        const hourString = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: 'numeric' }).format(date);
        const hour = parseInt(hourString.replace(' h', ''), 10);
        
        if (!dailyHours[dayKey]) dailyHours[dayKey] = Array(24).fill(0);
        // Take the max player count for that hour in that day
        if (players > dailyHours[dayKey][hour]) {
             dailyHours[dayKey][hour] = players;
        }
    });
    
    // Now calculate average peak hour
    let sumPeakHours = 0;
    let countDays = 0;
    Object.values(dailyHours).forEach(hoursArray => {
        let maxP = -1;
        let peakH = 0;
        hoursArray.forEach((val, h) => {
            if (val > maxP) {
                maxP = val;
                peakH = h;
            }
        });
        if (maxP > 0) {
            sumPeakHours += peakH;
            countDays++;
        }
    });
    
    const averagePeakHour = countDays > 0 ? Math.round(sumPeakHours / countDays) : 0;
    
    // Calculate uptime % per day
    const dailyArray = Object.values(dailyStats).map(ds => ({
        date: ds.date,
        maxPlayers: ds.maxPlayers,
        uptimePercent: ds.totalPoints > 0 ? Math.round((ds.uptimePoints / ds.totalPoints) * 100) : 0
    }));

    // Find trends (using moving averages or just looking back)
    // We'll calculate the average of the last 24h, 1-2 days ago, 7-8 days ago, etc.
    const getAverageForPeriod = (startHoursAgo, endHoursAgo) => {
        const start = now - startHoursAgo * 60 * 60 * 1000;
        const end = now - endHoursAgo * 60 * 60 * 1000;
        let sum = 0;
        let count = 0;
        history.forEach(point => {
            const time = new Date(point.timestamp).getTime();
            if (time >= start && time < end) {
                sum += (point.players || 0);
                count++;
            }
        });
        return count > 0 ? sum / count : null;
    };
    
    const avgCurrent24h = getAverageForPeriod(24, 0);
    const avgPrevious24h = getAverageForPeriod(48, 24); // Yesterday
    
    const avgCurrent7d = getAverageForPeriod(24*7, 0);
    const avgPrevious7d = getAverageForPeriod(24*14, 24*7); // Last Week
    
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
}
