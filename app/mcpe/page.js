"use client";

import { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, AreaChart, Area } from 'recharts';

export default function MCPEHome() {
  const [servers, setServers] = useState([]);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [selectedCountries, setSelectedCountries] = useState([]);
  const [selectedServers, setSelectedServers] = useState([]);
  const [profileHost, setProfileHost] = useState(null);
  const [showAllNations, setShowAllNations] = useState(false);
  const [period, setPeriod] = useState('24h');
  
  // Profile specific states
  const [serverProfileData, setServerProfileData] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [trendComparison, setTrendComparison] = useState('yesterday'); // 'yesterday', 'lastWeek'
  const [profileChartPeriod, setProfileChartPeriod] = useState('7d'); // '7d', '30d'

  const fetchServers = async () => {
    try {
      const res = await fetch('/api/mcpe/servers', { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setServers(data.servers);
        setTotalPlayers(data.totalPlayers);
        if (data.lastUpdated) {
          setLastUpdated(data.lastUpdated);
        }
      }
      
      const histRes = await fetch(`/api/mcpe/history?period=${period}`, { cache: 'no-store' });
      const histData = await histRes.json();
      if (histData.success && histData.history) {
        const formattedHistory = histData.history.map(item => {
            const date = new Date(item.timestamp);
            let timeLabel = '';
            if (period === '24h') {
                timeLabel = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } else {
                timeLabel = `${date.getDate()}/${date.getMonth()+1} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            }
            return {
                ...item,
                timeLabel,
                serverData: item.serverData || {}
            };
        });
        setHistoryData(formattedHistory);
      }
    } catch (error) {
      console.error("Failed to fetch servers:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleBanServer = async (host, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!window.confirm(`Are you sure you want to permanently delete the server ${host} from this list?`)) return;
    
    const adminPassword = window.prompt("Please enter the administrator password to perform this action:");
    if (!adminPassword) return;
    
    try {
      const res = await fetch('/api/mcpe/ban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host, password: adminPassword })
      });
      const data = await res.json();
      if (data.success) {
        setServers(servers.filter(s => s.host !== host));
      } else {
        alert(data.error || 'Error during deletion');
      }
    } catch (err) {
      console.error(err);
      alert('Network error');
    }
  };

  const handleAffiliate = async (host, is_affiliated) => {
    const adminPassword = window.prompt(`Please enter the administrator password to ${is_affiliated ? 'mark as affiliated' : 'remove affiliation'}:`);
    if (!adminPassword) return;
    
    try {
      const res = await fetch('/api/mcpe/affiliate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host, password: adminPassword, is_affiliated })
      });
      const data = await res.json();
      if (data.success) {
        setServers(servers.map(s => s.host === host ? { ...s, is_affiliated } : s));
      } else {
        alert(data.error || 'Error during affiliation');
      }
    } catch (err) {
      console.error(err);
      alert('Network error');
    }
  };

  useEffect(() => {
    fetchServers();
    const interval = setInterval(fetchServers, 60000); // 1 min update
    return () => clearInterval(interval);
  }, [period]);

  useEffect(() => {
      if (profileHost) {
          setProfileLoading(true);
          fetch(`/api/mcpe/server_profile?host=${profileHost}`)
              .then(res => res.json())
              .then(data => {
                  if (data.success) {
                      setServerProfileData(data);
                  }
                  setProfileLoading(false);
              })
              .catch(err => {
                  console.error(err);
                  setProfileLoading(false);
              });
      } else {
          setServerProfileData(null);
      }
  }, [profileHost]);

  const nationsCount = {};
  servers.forEach(s => {
    if (s.is_affiliated) return;
    const players = s.status?.players || 0;
    if (s.country && s.country !== 'unknown') {
        nationsCount[s.country] = (nationsCount[s.country] || 0) + players;
    }
  });
  
  const allSortedNations = Object.entries(nationsCount).sort((a, b) => b[1] - a[1]);
  const displayedNations = showAllNations ? allSortedNations : allSortedNations.slice(0, 5);

  const availableCountries = Object.keys(nationsCount).sort();
  const displayedServers = servers.filter(s => selectedCountries.length === 0 || selectedCountries.includes(s.country));

  const toggleCountry = (country) => {
    if (selectedCountries.includes(country)) {
        setSelectedCountries(selectedCountries.filter(c => c !== country));
    } else {
        setSelectedCountries([...selectedCountries, country]);
    }
  };

  const toggleServer = (host) => {
    if (selectedServers.includes(host)) {
        setSelectedServers(selectedServers.filter(h => h !== host));
    } else {
        setSelectedServers([...selectedServers, host]);
    }
  };

  let displayPlayers = 0;
  let displayServersCount = 0;
  let statLabel = "Players online (Global) / Unique Servers";

  if (selectedServers.length > 0) {
      displayPlayers = selectedServers.reduce((sum, host) => {
          const srv = servers.find(s => s.host === host);
          return sum + (srv?.status?.players || 0);
      }, 0);
      displayServersCount = selectedServers.length;
      statLabel = "Players online (Selection) / Selected Servers";
  } else if (selectedCountries.length > 0) {
      displayPlayers = displayedServers.reduce((sum, srv) => sum + (srv.status?.players || 0), 0);
      displayServersCount = displayedServers.length;
      statLabel = "Players online (Country Filter) / Filtered Servers";
  } else {
      displayPlayers = servers.filter(s => !s.is_affiliated).reduce((sum, srv) => sum + (srv.status?.players || 0), 0);
      displayServersCount = servers.filter(s => !s.is_affiliated).length;
  }

  const chartLines = useMemo(() => {
      if (selectedServers.length > 0) return selectedServers.slice(0, 10);
      if (selectedCountries.length === 1) {
          return servers
              .filter(s => s.country === selectedCountries[0])
              .sort((a, b) => (b.status?.players || 0) - (a.status?.players || 0))
              .slice(0, 10)
              .map(s => s.host);
      }
      return [];
  }, [selectedServers, selectedCountries, servers]);

  const nationsToRender = useMemo(() => {
      if (selectedCountries.length > 0) return selectedCountries.slice(0, 10);
      return allSortedNations.slice(0, 10).map(([country]) => country);
  }, [selectedCountries, allSortedNations]);

  const chartData = useMemo(() => {
    const validHosts = new Set(servers.filter(s => !s.is_affiliated).map(s => s.host));

    return historyData.map(point => {
        let entry = { timeLabel: point.timeLabel };
        
        if (chartLines.length > 0) {
            chartLines.forEach(host => {
                entry[host] = point.serverData[host] || 0;
            });
        } else if (selectedCountries.length > 1) {
            let sum = 0;
            const countryServers = servers.filter(s => selectedCountries.includes(s.country)).map(s => s.host);
            countryServers.forEach(host => {
                sum += (point.serverData[host] || 0);
            });
            entry.totalPlayers = sum;
        } else {
            let sum = 0;
            if (point.serverData && Object.keys(point.serverData).length > 0) {
                for (const [host, players] of Object.entries(point.serverData)) {
                    if (validHosts.has(host)) {
                        sum += players;
                    }
                }
                entry.totalPlayers = sum;
            } else {
                entry.totalPlayers = point.totalPlayers;
            }
        }
        
        return entry;
    });
  }, [historyData, chartLines, selectedCountries, servers]);

  const nationsChartData = useMemo(() => {
     if (availableCountries.length === 0) return [];
     const nationsKeys = nationsToRender;
     
     const serversByCountry = {};
     servers.forEach(s => {
         if (!serversByCountry[s.country]) serversByCountry[s.country] = [];
         serversByCountry[s.country].push(s.host);
     });
     
     return historyData.map(point => {
         let entry = { timeLabel: point.timeLabel };
         nationsKeys.forEach(country => {
             let sum = 0;
             (serversByCountry[country] || []).forEach(host => {
                 sum += (point.serverData[host] || 0);
             });
             entry[country] = sum;
         });
         return entry;
     });
  }, [historyData, availableCountries, selectedCountries, servers]);

  const colors = ["#f59e0b", "#3b82f6", "#10b981", "#ec4899", "#8b5cf6", "#ef4444", "#14b8a6", "#f97316"];

  const profileStats = useMemo(() => {
      if (!profileHost || !serverProfileData) return null;
      const srv = servers.find(s => s.host === profileHost);
      if (!srv) return null;
      
      const { dailyData, averagePeakHour, trends } = serverProfileData;
      
      // Calculate trend percentage
      let trendValue = 0;
      const currentAvg = trendComparison === 'yesterday' ? trends.current24h : trends.current7d;
      const prevAvg = trendComparison === 'yesterday' ? trends.yesterday : trends.lastWeek;
      
      if (prevAvg && prevAvg > 0 && currentAvg !== null) {
          trendValue = (((currentAvg - prevAvg) / prevAvg) * 100).toFixed(1);
      } else if (!prevAvg && currentAvg > 0) {
          trendValue = 100;
      }
      
      const recordTimestamp = srv.status?.record_timestamp ? new Date(srv.status.record_timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Unknown';
      
      // Filter daily data based on selected profileChartPeriod (7d or 30d)
      let filteredDailyData = [...dailyData];
      if (profileChartPeriod === '7d') {
          filteredDailyData = filteredDailyData.slice(-7);
      } else {
          filteredDailyData = filteredDailyData.slice(-30);
      }
      
      // Format dates for charts (e.g. "17/08")
      filteredDailyData = filteredDailyData.map(d => {
          const parts = d.date.split('-');
          return {
              ...d,
              shortDate: `${parts[2]}/${parts[1]}`
          }
      });
      
      return {
          server: srv,
          peakHour: `${averagePeakHour}h00`,
          trend: trendValue,
          trendBasis: trendComparison === 'yesterday' ? 'vs Yesterday' : 'vs Last Week',
          recordAllTime: srv.status?.record_players || 0,
          recordTimestamp,
          dailyCharts: filteredDailyData
      };
  }, [profileHost, serverProfileData, servers, trendComparison, profileChartPeriod]);

  return (
    <div className="container">
      <header className="header">
        <h1 className="title">MCPE Server Tracker</h1>
        <p className="subtitle">Real-Time Data & Analytics</p>
        {lastUpdated && (
          <p style={{ fontSize: '0.85rem', color: '#10b981', marginTop: '0.5rem', fontWeight: 'bold' }}>
            Last updated: {new Date(lastUpdated).toLocaleTimeString()}
          </p>
        )}
      </header>

      <div className="dashboard" style={{ gridTemplateColumns: profileHost ? '380px 1fr' : undefined, gap: '2rem' }}>
        
        {profileHost && (
            <aside className="server-profile" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {profileStats ? (
                <>
                <div className="glass-panel" style={{ textAlign: 'center', position: 'relative', overflow: 'hidden', padding: 0, flexShrink: 0 }}>
                    <button 
                        onClick={() => setProfileHost(null)}
                        style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(239, 68, 68, 0.8)', color: 'white', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold' }}
                        title="Close Profile"
                    >
                        ×
                    </button>
                    {profileStats.server.banner && (
                        <div style={{ width: '100%', height: '100px', backgroundImage: `url(${profileStats.server.banner})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.5 }}></div>
                    )}
                    <div style={{ padding: '1.5rem', position: 'relative', marginTop: profileStats.server.banner ? '-50px' : '0' }}>
                        {profileStats.server.logo && (
                            <img src={profileStats.server.logo} style={{ width: 80, height: 80, borderRadius: '50%', border: '3px solid #1e293b', boxShadow: '0 4px 10px rgba(0,0,0,0.5)', marginBottom: '1rem', background: '#1e293b' }} />
                        )}
                        <h2 style={{ color: '#f59e0b', margin: '0 0 0.5rem 0', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>{profileStats.server.name || profileStats.server.host}</h2>
                        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem', background: 'rgba(0,0,0,0.3)', padding: '4px 12px', borderRadius: '12px', display: 'inline-block' }}>{profileStats.server.host}:{profileStats.server.port || 19132}</p>
                        
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '1.5rem', background: 'rgba(0,0,0,0.2)', padding: '0.8rem', borderRadius: '12px' }}>
                            <div style={{ 
                                width: 12, height: 12, borderRadius: '50%', 
                                background: profileStats.server.status?.online ? '#10b981' : '#ef4444', 
                                animation: profileStats.server.status?.online ? 'pulse-dot 2s infinite' : 'pulse-dot-red 2s infinite' 
                            }}></div>
                            <span style={{ fontWeight: 'bold', fontSize: '1.1rem', letterSpacing: '1px' }}>{profileStats.server.status?.online ? 'ONLINE' : 'OFFLINE'}</span>
                        </div>
                        {profileStats.server.status?.online && (
                            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', marginTop: '1rem', textShadow: '0 0 15px rgba(255,255,255,0.2)' }}>
                                {profileStats.server.status.players} <span style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>/ {profileStats.server.status.max || '∞'}</span>
                            </div>
                        )}
                    </div>
                </div>
                
                <div className="glass-panel">
                    <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Advanced Stats</span>
                        {profileLoading && <span style={{ fontSize: '0.75rem', color: '#f59e0b' }}>Loading...</span>}
                    </h3>
                    <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>All-Time Peak</span>
                            <div style={{ textAlign: 'right' }}>
                                <strong style={{ color: '#ec4899', fontSize: '1.2rem', textShadow: '0 0 10px rgba(236,72,153,0.3)' }}>{profileStats.recordAllTime.toLocaleString()}</strong>
                                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>{profileStats.recordTimestamp}</div>
                            </div>
                        </li>
                        <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} title="Moyenne de l'heure de pointe observée chaque jour">
                            <span style={{ color: 'var(--text-secondary)', borderBottom: '1px dotted rgba(255,255,255,0.3)', cursor: 'help' }}>Peak Hour (?)</span>
                            <strong style={{ color: '#3b82f6', fontSize: '1.1rem' }}>~ {profileStats.peakHour}</strong>
                        </li>
                        <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Trend</span>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <select 
                                    value={trendComparison} 
                                    onChange={(e) => setTrendComparison(e.target.value)}
                                    style={{ background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '2px 4px', fontSize: '0.75rem', outline: 'none' }}
                                >
                                    <option value="yesterday">vs Yesterday</option>
                                    <option value="lastWeek">vs Last Week</option>
                                </select>
                                <strong style={{ color: profileStats.trend > 0 ? '#10b981' : profileStats.trend < 0 ? '#ef4444' : 'white', fontSize: '1.1rem', minWidth: '60px', textAlign: 'right' }}>
                                    {profileStats.trend > 0 ? '+' : ''}{profileStats.trend}%
                                </strong>
                            </div>
                        </li>
                    </ul>
                </div>
                
                <div className="glass-panel">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
                        <h3 style={{ margin: 0 }}>Daily Analytics</h3>
                        <div style={{ display: 'flex', gap: '4px' }}>
                            {['7d', '30d'].map(p => (
                                <button 
                                    key={p} onClick={() => setProfileChartPeriod(p)}
                                    style={{ background: profileChartPeriod === p ? '#f59e0b' : 'transparent', color: profileChartPeriod === p ? '#fff' : 'rgba(255,255,255,0.5)', border: 'none', borderRadius: '4px', padding: '2px 6px', fontSize: '0.75rem', cursor: 'pointer' }}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textAlign: 'center' }}>Daily Peak Players</h4>
                    <div style={{ width: '100%', height: '140px', marginBottom: '1.5rem' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={profileStats.dailyCharts} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                <XAxis dataKey="shortDate" stroke="rgba(255,255,255,0.3)" tick={{fill: 'rgba(255,255,255,0.5)', fontSize: 10}} />
                                <YAxis stroke="rgba(255,255,255,0.3)" tick={{fill: 'rgba(255,255,255,0.5)', fontSize: 10}} />
                                <Tooltip contentStyle={{ backgroundColor: 'rgba(15,23,42,0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }} itemStyle={{ color: '#ec4899', fontWeight: 'bold' }} />
                                <Bar dataKey="maxPlayers" name="Peak Players" fill="#ec4899" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textAlign: 'center' }}>Daily Uptime (%)</h4>
                    <div style={{ width: '100%', height: '100px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={profileStats.dailyCharts} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                <XAxis dataKey="shortDate" stroke="rgba(255,255,255,0.3)" tick={{fill: 'rgba(255,255,255,0.5)', fontSize: 10}} />
                                <YAxis domain={[0, 100]} stroke="rgba(255,255,255,0.3)" tick={{fill: 'rgba(255,255,255,0.5)', fontSize: 10}} />
                                <Tooltip contentStyle={{ backgroundColor: 'rgba(15,23,42,0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }} itemStyle={{ color: '#10b981', fontWeight: 'bold' }} />
                                <Area type="step" dataKey="uptimePercent" name="Uptime %" stroke="#10b981" fill="rgba(16,185,129,0.2)" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                
                <div className="glass-panel">
                    <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>Information</h3>
                    
                    {profileStats.server.country && profileStats.server.country !== 'unknown' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem', background: 'rgba(255,255,255,0.05)', padding: '0.8rem', borderRadius: '12px' }}>
                            <img src={`https://flagcdn.com/w40/${profileStats.server.country.toLowerCase()}.png`} width="32" alt={profileStats.server.country} style={{ borderRadius: '4px' }} />
                            <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{profileStats.server.country}</span>
                        </div>
                    )}
                    
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {(profileStats.server.gameModes || ['survival']).map(gm => (
                            <span key={gm} style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', padding: '6px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'capitalize', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                                {gm}
                            </span>
                        ))}
                    </div>
                </div>
                </>
                ) : (
                    <div className="glass-panel" style={{ textAlign: 'center', padding: '2rem' }}>
                        <div className="loader" style={{ border: '4px solid rgba(255,255,255,0.1)', borderTop: '4px solid #3b82f6', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite', margin: '0 auto 1rem auto' }}></div>
                        <p style={{ color: 'var(--text-secondary)' }}>Loading deep analytics...</p>
                    </div>
                )}
            </aside>
        )}
        
        <main>
          <div className="glass-panel" style={{ border: selectedServers.length > 0 ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)' }}>
            <div className="stat-box">
              <div className="stat-value" style={{ fontSize: '2.5rem', color: selectedServers.length > 0 ? '#3b82f6' : (selectedCountries.length > 0 ? '#f59e0b' : 'white') }}>
                {loading && servers.length === 0 ? '-' : `${displayPlayers.toLocaleString()} / ${displayServersCount}`}
              </div>
              <div className="stat-label">{statLabel}</div>
            </div>

            {historyData.length > 0 && (
                <div style={{ marginTop: '2rem', marginBottom: '2rem', height: '280px', width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                        <h2 style={{ margin: 0 }}>
                            {selectedServers.length > 0 ? "Selected Servers Trend" : 
                             selectedCountries.length === 1 ? `Server Breakdown (${selectedCountries[0].toUpperCase()})` :
                             selectedCountries.length > 1 ? `Players Trend (Country Filter)` : "Global Players Trend"}
                        </h2>
                        
                        <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(15, 23, 42, 0.6)', padding: '0.3rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                            {['24h', '7d', '30d'].map(p => (
                                <button 
                                    key={p}
                                    onClick={() => setPeriod(p)}
                                    style={{
                                        background: period === p ? '#3b82f6' : 'transparent',
                                        color: period === p ? 'white' : 'rgba(255,255,255,0.7)',
                                        border: 'none',
                                        padding: '0.4rem 0.8rem',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontSize: '0.85rem',
                                        fontWeight: 'bold',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {p === '24h' ? 'Last 24h' : p === '7d' ? '7 Days' : '30 Days'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 25 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                            <XAxis dataKey="timeLabel" stroke="rgba(255,255,255,0.5)" tick={{fill: 'rgba(255,255,255,0.7)', fontSize: 12}} />
                            <YAxis stroke="rgba(255,255,255,0.5)" tick={{fill: 'rgba(255,255,255,0.7)', fontSize: 12}} />
                            <Tooltip 
                                contentStyle={{ backgroundColor: 'rgba(15,23,42,0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                                itemStyle={{ fontWeight: 'bold' }}
                                itemSorter={(item) => -item.value}
                            />
                            {chartLines.length > 0 && <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />}
                            
                            {chartLines.length > 0 ? (
                                chartLines.map((host, i) => (
                                    <Line key={host} type="monotone" dataKey={host} name={host} stroke={colors[i % colors.length]} strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                                ))
                            ) : (
                                <Line type="monotone" dataKey="totalPlayers" name="Players" stroke="#f59e0b" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#f59e0b', stroke: '#fff', strokeWidth: 2 }} />
                            )}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}

            {historyData.length > 0 && nationsChartData.length > 0 && selectedServers.length === 0 && (
                <div style={{ marginTop: '2rem', marginBottom: '2rem', height: '250px', width: '100%' }}>
                    <h2 style={{ marginBottom: '1rem' }}>Nations Comparison</h2>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={nationsChartData} margin={{ top: 5, right: 20, left: 0, bottom: 25 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                            <XAxis dataKey="timeLabel" stroke="rgba(255,255,255,0.5)" tick={{fill: 'rgba(255,255,255,0.7)', fontSize: 12}} />
                            <YAxis stroke="rgba(255,255,255,0.5)" tick={{fill: 'rgba(255,255,255,0.7)', fontSize: 12}} />
                            <Tooltip 
                                contentStyle={{ backgroundColor: 'rgba(15,23,42,0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                                itemStyle={{ fontWeight: 'bold' }}
                                itemSorter={(item) => -item.value}
                            />
                            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                            {nationsToRender.map((nation, i) => (
                                <Line key={nation} type="monotone" dataKey={nation} name={nation.toUpperCase()} stroke={colors[i % colors.length]} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem', marginTop: '3rem' }}>
                <h2 style={{ margin: 0 }}>MCPE Servers (Minecraft Bedrock)</h2>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '0.9rem', marginRight: '0.5rem' }}>Country Filters:</span>
                    
                    <button 
                        onClick={() => setSelectedCountries([])}
                        style={{
                            background: selectedCountries.length === 0 ? '#f59e0b' : 'rgba(15, 23, 42, 0.8)',
                            color: selectedCountries.length === 0 ? '#000' : 'white',
                            border: `1px solid ${selectedCountries.length === 0 ? '#f59e0b' : 'rgba(255,255,255,0.2)'}`,
                            padding: '0.4rem 0.8rem',
                            borderRadius: '20px',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: 'bold',
                            transition: 'all 0.2s'
                        }}
                    >
                        🌍 All
                    </button>
                    
                    {availableCountries.map(c => (
                        <button 
                            key={c}
                            onClick={() => toggleCountry(c)}
                            title={`Filter by ${c}`}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: selectedCountries.includes(c) ? '#f59e0b' : 'rgba(15, 23, 42, 0.8)',
                                color: selectedCountries.includes(c) ? '#000' : 'white',
                                border: `1px solid ${selectedCountries.includes(c) ? '#f59e0b' : 'rgba(255,255,255,0.2)'}`,
                                padding: '0.4rem 0.8rem',
                                borderRadius: '20px',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                fontWeight: 'bold',
                                transition: 'all 0.2s'
                            }}
                        >
                            <img src={`https://flagcdn.com/w20/${c.toLowerCase()}.png`} width="16" alt={c} style={{ borderRadius: '2px' }} />
                        </button>
                    ))}
                </div>
                {selectedServers.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
                        <span style={{ fontSize: '0.9rem', color: '#3b82f6', fontWeight: 'bold' }}>{selectedServers.length} servers selected</span>
                        <button onClick={() => setSelectedServers([])} style={{ background: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '4px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem' }}>
                            Clear selection
                        </button>
                    </div>
                )}
            </div>
            
            {loading && servers.length === 0 ? (
              <div className="center-content">
                <div className="loader"></div>
              </div>
            ) : (
              <ul className="server-list">
                {displayedServers.map((server, idx) => {
                  const isSelected = selectedServers.includes(server.host);
                  return (
                  <li 
                    key={server.host} 
                    className={`server-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleServer(server.host)}
                    style={{
                      position: 'relative',
                      overflow: 'hidden',
                      backgroundImage: server.banner ? `linear-gradient(to right, rgba(15, 23, 42, 0.95) 40%, rgba(15, 23, 42, 0.6)), url(${server.banner})` : 'none',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      borderLeft: server.banner ? '4px solid var(--primary)' : undefined,
                      border: isSelected ? '2px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.1)',
                      boxShadow: isSelected ? '0 0 15px rgba(59, 130, 246, 0.3)' : 'none',
                      cursor: 'pointer',
                      transform: isSelected ? 'scale(1.01)' : 'scale(1)',
                      transition: 'all 0.2s',
                      opacity: server.is_affiliated ? 0.6 : 1,
                      filter: server.is_affiliated ? 'grayscale(0.7)' : 'none'
                    }}
                  >
                    {server.is_affiliated && (
                        <div style={{ position: 'absolute', top: '10px', right: '10px', background: '#f59e0b', color: '#000', fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', zIndex: 3 }}>
                            FEATURED
                        </div>
                    )}
                    <div className="server-info" style={{ display: 'flex', alignItems: 'center', gap: '1rem', zIndex: 1, position: 'relative' }}>
                      {server.logo && (
                        <img src={server.logo} alt={server.name} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.1)' }} />
                      )}
                      <div className="server-info-text">
                        <h3 style={{ textShadow: server.banner ? '0 2px 4px rgba(0,0,0,0.8)' : 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {server.country && server.country !== 'unknown' && (
                              <img 
                                src={`https://flagcdn.com/w20/${server.country.toLowerCase()}.png`} 
                                width="20" 
                                alt={server.country} 
                                title={`Country: ${server.country}`}
                                style={{ borderRadius: '2px' }}
                              />
                          )}
                          {server.name || server.host}
                        </h3>
                        <p className="server-address">{server.host}:{server.port || 19132}</p>
                        <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                           {(server.gameModes && server.gameModes.length > 0 ? server.gameModes : ['other']).map((mode, i) => (
                             <span key={i} style={{ 
                                 fontSize: '0.75rem', 
                                 background: 'rgba(245, 158, 11, 0.2)', 
                                 color: '#f59e0b', 
                                 padding: '2px 8px', 
                                 borderRadius: '12px',
                                 textTransform: 'uppercase',
                                 fontWeight: 'bold'
                             }}>
                               {mode}
                             </span>
                           ))}
                        </div>
                      </div>
                    </div>
                    <div className="server-stats" style={{ zIndex: 1, position: 'relative' }}>
                      {server.status && server.status.online ? (
                        <>
                          <span className="players-count" style={{ textShadow: server.banner ? '0 1px 3px rgba(0,0,0,0.9)' : 'none' }}>
                            {server.status.players} {server.status.max > 0 ? `/ ${server.status.max}` : 'Players'}
                          </span>
                          {server.status.ping > 0 && <span className="ping-info">{server.status.ping}ms</span>}
                          <span className="status-badge status-online" style={{ boxShadow: server.banner ? '0 0 10px rgba(16, 185, 129, 0.3)' : 'none' }}>ONLINE</span>
                        </>
                      ) : (
                        <span className="status-badge status-offline">OFFLINE</span>
                      )}
                      
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                handleAffiliate(server.host, !server.is_affiliated);
                            }}
                            title={server.is_affiliated ? "Remove Affiliation" : "Mark as Affiliated"}
                            style={{
                               background: server.is_affiliated ? 'rgba(245, 158, 11, 0.8)' : 'rgba(245, 158, 11, 0.2)',
                               border: '1px solid rgba(245, 158, 11, 0.5)',
                               color: server.is_affiliated ? '#fff' : '#f59e0b',
                               borderRadius: '50%',
                               width: '32px',
                               height: '32px',
                               display: 'flex',
                               alignItems: 'center',
                               justifyContent: 'center',
                               cursor: 'pointer',
                               transition: 'all 0.2s'
                            }}
                          >
                            ⭐
                          </button>
                          <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                setProfileHost(server.host);
                            }}
                            title="View Server Profile"
                            style={{
                               marginLeft: '15px',
                               background: 'rgba(59, 130, 246, 0.2)',
                               border: '1px solid rgba(59, 130, 246, 0.5)',
                               color: '#3b82f6',
                               borderRadius: '50%',
                               width: '32px',
                               height: '32px',
                               display: 'flex',
                               alignItems: 'center',
                               justifyContent: 'center',
                               cursor: 'pointer',
                               transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#3b82f6'; e.currentTarget.style.color = '#fff'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)'; e.currentTarget.style.color = '#3b82f6'; }}
                          >
                            👤
                          </button>
                      <button 
                        onClick={(e) => handleBanServer(server.host, e)}
                        title="Report as Fake/Cross-play (Delete)"
                        style={{
                           marginLeft: '15px',
                           background: 'rgba(239, 68, 68, 0.2)',
                           border: '1px solid rgba(239, 68, 68, 0.5)',
                           color: '#ef4444',
                           borderRadius: '50%',
                           width: '32px',
                           height: '32px',
                           display: 'flex',
                           alignItems: 'center',
                           justifyContent: 'center',
                           cursor: 'pointer',
                           transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'; e.currentTarget.style.color = '#ef4444'; }}
                      >
                         🗑️
                      </button>
                      </div>
                    </div>
                  </li>
                )})}
                {displayedServers.length === 0 && !loading && (
                  <p style={{ color: 'var(--text-secondary)' }}>No servers found for this nation.</p>
                )}
              </ul>
            )}
          </div>
        </main>

        {selectedServers.length !== 1 && (
        <aside>
          <div className="glass-panel" style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ marginBottom: '1rem', fontSize: '1.2rem', color: '#f59e0b' }}>🏆 Top Nations</h2>
            
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {displayedNations.map(([country, count]) => (
                <li key={country} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <img src={`https://flagcdn.com/w20/${country.toLowerCase()}.png`} width="18" alt={country} style={{ borderRadius: '2px' }} /> 
                    {country}
                  </span>
                  <span style={{ fontWeight: 'bold', color: 'var(--text-secondary)' }}>{count.toLocaleString()}</span>
                </li>
              ))}
            </ul>
            
            {allSortedNations.length > 5 && (
              <button 
                onClick={() => setShowAllNations(!showAllNations)}
                style={{
                  width: '100%',
                  marginTop: '1rem',
                  padding: '0.5rem',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              >
                {showAllNations ? 'See Less ▲' : `See All (${allSortedNations.length}) ▼`}
              </button>
            )}
          </div>
          
          <div className="glass-panel">
            <h2 style={{ marginBottom: '1rem', fontSize: '1.2rem' }}>Phantom Scraper Sources</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              The bot automatically scrapes servers from these community sites:
            </p>
            <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <li style={{ marginBottom: '10px' }}>
                <a href="https://minecraftpocket-servers.com/" target="_blank" rel="noopener noreferrer" style={{ color: '#f59e0b', textDecoration: 'none' }}>🌐 minecraftpocket-servers.com</a>
              </li>
            </ul>
          </div>
        </aside>
        )}
      </div>
    </div>
  );
}
