"use client";

import { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';



export default function MCPEHome() {
  const [servers, setServers] = useState([]);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [selectedCountries, setSelectedCountries] = useState([]);
  const [selectedServers, setSelectedServers] = useState([]);

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
      
      const histRes = await fetch('/api/mcpe/history', { cache: 'no-store' });
      const histData = await histRes.json();
      if (histData.success && histData.history) {
        // Format history for the chart
        const formattedHistory = histData.history.map(item => ({
            ...item,
            timeLabel: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            serverData: item.serverData || {}
        }));
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
    
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer définitivement le serveur ${host} de cette liste ?`)) return;
    
    const adminPassword = window.prompt("Veuillez entrer le mot de passe administrateur pour effectuer cette action :");
    if (!adminPassword) return;
    
    try {
      const res = await fetch('/api/mcpe/ban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host, password: adminPassword })
      });
      const data = await res.json();
      if (data.success) {
        // Remove locally immediately for snappy UI
        setServers(servers.filter(s => s.host !== host));
      } else {
        alert(data.error || 'Erreur lors de la suppression');
      }
    } catch (err) {
      console.error(err);
      alert('Erreur réseau');
    }
  };

  useEffect(() => {
    fetchServers();
    // Refresh every 30 seconds
    const interval = setInterval(fetchServers, 30000);
    return () => clearInterval(interval);
  }, []);

  const nationsCount = {};
  const gameModesCount = {};
  servers.forEach(s => {
    const players = s.status?.players || 0;
    if (s.country && s.country !== 'unknown') {
        nationsCount[s.country] = (nationsCount[s.country] || 0) + players;
    }
    const gms = s.gameModes && s.gameModes.length > 0 ? s.gameModes : ['autre'];
    gms.forEach(gm => {
        const modeUpper = gm.toUpperCase();
        gameModesCount[modeUpper] = (gameModesCount[modeUpper] || 0) + players;
    });
  });
  
  const topNations = Object.entries(nationsCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topGameModes = Object.entries(gameModesCount).sort((a, b) => b[1] - a[1]).slice(0, 5);

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

  // Top Stats Calculation
  let displayPlayers = 0;
  let displayServersCount = 0;
  let statLabel = "Joueurs en ligne (Global) / Serveurs uniques";

  if (selectedServers.length > 0) {
      displayPlayers = selectedServers.reduce((sum, host) => {
          const srv = servers.find(s => s.host === host);
          return sum + (srv?.status?.players || 0);
      }, 0);
      displayServersCount = selectedServers.length;
      statLabel = "Joueurs en ligne (Sélection) / Serveurs sélectionnés";
  } else if (selectedCountries.length > 0) {
      displayPlayers = displayedServers.reduce((sum, srv) => sum + (srv.status?.players || 0), 0);
      displayServersCount = displayedServers.length;
      statLabel = "Joueurs en ligne (Filtre Pays) / Serveurs filtrés";
  } else {
      displayPlayers = totalPlayers;
      displayServersCount = servers.length;
  }

  // Chart Data Calculation
  const chartData = useMemo(() => {
    return historyData.map(point => {
        let entry = { timeLabel: point.timeLabel };
        
        if (selectedServers.length > 0) {
            selectedServers.forEach(host => {
                entry[host] = point.serverData[host] || 0;
            });
        } else if (selectedCountries.length > 0) {
            let sum = 0;
            const countryServers = servers.filter(s => selectedCountries.includes(s.country)).map(s => s.host);
            countryServers.forEach(host => {
                sum += (point.serverData[host] || 0);
            });
            entry.totalPlayers = sum;
        } else {
            entry.totalPlayers = point.totalPlayers;
        }
        
        return entry;
    });
  }, [historyData, selectedServers, selectedCountries, servers]);

  // Nations Chart Data
  const nationsChartData = useMemo(() => {
     if (topNations.length === 0) return [];
     const topNationsKeys = topNations.map(t => t[0]);
     
     const serversByCountry = {};
     servers.forEach(s => {
         if (!serversByCountry[s.country]) serversByCountry[s.country] = [];
         serversByCountry[s.country].push(s.host);
     });
     
     return historyData.map(point => {
         let entry = { timeLabel: point.timeLabel };
         topNationsKeys.forEach(country => {
             let sum = 0;
             (serversByCountry[country] || []).forEach(host => {
                 sum += (point.serverData[host] || 0);
             });
             entry[country] = sum;
         });
         return entry;
     });
  }, [historyData, topNations, servers]);

  const colors = ["#f59e0b", "#3b82f6", "#10b981", "#ec4899", "#8b5cf6", "#ef4444", "#14b8a6", "#f97316"];

  return (
    <div className="container">
      <header className="header">
        <h1 className="title">MCPE Server Tracker</h1>
        <p className="subtitle">Données ultra fluides en Temps Réel</p>
        {lastUpdated && (
          <p style={{ fontSize: '0.85rem', color: '#10b981', marginTop: '0.5rem', fontWeight: 'bold' }}>
            Dernière actualisation : {new Date(lastUpdated).toLocaleTimeString()}
          </p>
        )}
      </header>

      <div className="dashboard">
        <main>
          <div className="glass-panel" style={{ border: selectedServers.length > 0 ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)' }}>
            <div className="stat-box">
              <div className="stat-value" style={{ fontSize: '2.5rem', color: selectedServers.length > 0 ? '#3b82f6' : (selectedCountries.length > 0 ? '#f59e0b' : 'white') }}>
                {loading && servers.length === 0 ? '-' : `${displayPlayers.toLocaleString()} / ${displayServersCount}`}
              </div>
              <div className="stat-label">{statLabel}</div>
            </div>

            {historyData.length > 0 && (
                <div style={{ marginTop: '2rem', marginBottom: '2rem', height: '250px', width: '100%' }}>
                    <h2 style={{ marginBottom: '1rem' }}>
                        {selectedServers.length > 0 ? "Évolution des serveurs sélectionnés" : 
                         selectedCountries.length > 0 ? `Évolution des joueurs (Filtre Pays)` : "Évolution Globale des joueurs"}
                    </h2>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                            <XAxis dataKey="timeLabel" stroke="rgba(255,255,255,0.5)" tick={{fill: 'rgba(255,255,255,0.7)', fontSize: 12}} />
                            <YAxis stroke="rgba(255,255,255,0.5)" tick={{fill: 'rgba(255,255,255,0.7)', fontSize: 12}} />
                            <Tooltip 
                                contentStyle={{ backgroundColor: 'rgba(15,23,42,0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                                itemStyle={{ fontWeight: 'bold' }}
                            />
                            {selectedServers.length > 0 && <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />}
                            
                            {selectedServers.length > 0 ? (
                                selectedServers.map((host, i) => (
                                    <Line key={host} type="monotone" dataKey={host} name={host} stroke={colors[i % colors.length]} strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                                ))
                            ) : (
                                <Line type="monotone" dataKey="totalPlayers" name="Joueurs" stroke="#f59e0b" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#f59e0b', stroke: '#fff', strokeWidth: 2 }} />
                            )}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}

            {historyData.length > 0 && nationsChartData.length > 0 && selectedServers.length === 0 && selectedCountries.length === 0 && (
                <div style={{ marginTop: '2rem', marginBottom: '2rem', height: '250px', width: '100%' }}>
                    <h2 style={{ marginBottom: '1rem' }}>🏆 Guerre des Nations (Top 5)</h2>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={nationsChartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                            <XAxis dataKey="timeLabel" stroke="rgba(255,255,255,0.5)" tick={{fill: 'rgba(255,255,255,0.7)', fontSize: 12}} />
                            <YAxis stroke="rgba(255,255,255,0.5)" tick={{fill: 'rgba(255,255,255,0.7)', fontSize: 12}} />
                            <Tooltip 
                                contentStyle={{ backgroundColor: 'rgba(15,23,42,0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                                itemStyle={{ fontWeight: 'bold' }}
                            />
                            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                            {topNations.map((nation, i) => (
                                <Line key={nation[0]} type="monotone" dataKey={nation[0]} name={nation[0].toUpperCase()} stroke={colors[i % colors.length]} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem', marginTop: '3rem' }}>
                <h2 style={{ margin: 0 }}>Serveurs MCPE (Minecraft Bedrock)</h2>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '0.9rem', marginRight: '0.5rem' }}>Filtres Pays :</span>
                    
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
                        🌍 Tous
                    </button>
                    
                    {availableCountries.map(c => (
                        <button 
                            key={c}
                            onClick={() => toggleCountry(c)}
                            title={`Filtrer par ${c}`}
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
                        <span style={{ fontSize: '0.9rem', color: '#3b82f6', fontWeight: 'bold' }}>{selectedServers.length} serveurs sélectionnés</span>
                        <button onClick={() => setSelectedServers([])} style={{ background: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '4px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem' }}>
                            Tout désélectionner
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
                    key={idx} 
                    className="server-item" 
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
                      transition: 'all 0.2s'
                    }}
                  >
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
                                title={`Pays: ${server.country}`}
                                style={{ borderRadius: '2px' }}
                              />
                          )}
                          {server.name || server.host}
                        </h3>
                        <p className="server-address">{server.host}:{server.port || 5520}</p>
                        <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                           {(server.gameModes && server.gameModes.length > 0 ? server.gameModes : ['autre']).map((mode, i) => (
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
                            {server.status.players} {server.status.max > 0 ? `/ ${server.status.max}` : 'Joueurs'}
                          </span>
                          {server.status.ping > 0 && <span className="ping-info">{server.status.ping}ms</span>}
                          <span className="status-badge status-online" style={{ boxShadow: server.banner ? '0 0 10px rgba(16, 185, 129, 0.3)' : 'none' }}>EN LIGNE</span>
                        </>
                      ) : (
                        <span className="status-badge status-offline">HORS LIGNE</span>
                      )}
                      
                      <button 
                        onClick={(e) => handleBanServer(server.host, e)}
                        title="Signaler comme Fake/Cross-play (Supprimer)"
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
                        onMouseEnter={(e) => e.currentTarget.style.background = '#ef4444'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                      >
                         🗑️
                      </button>
                    </div>
                  </li>
                )})}
                {displayedServers.length === 0 && !loading && (
                  <p style={{ color: 'var(--text-secondary)' }}>Aucun serveur trouvé pour cette nation.</p>
                )}
              </ul>
            )}
          </div>
        </main>

        <aside>
          <div className="glass-panel" style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ marginBottom: '1rem', fontSize: '1.2rem', color: '#f59e0b' }}>🏆 Tendances (Top 5)</h2>
            
            <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', marginTop: '1rem' }}>Top Nations</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {topNations.map(([country, count]) => (
                <li key={country} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem', fontSize: '0.9rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <img src={`https://flagcdn.com/w20/${country.toLowerCase()}.png`} width="16" alt={country} style={{ borderRadius: '2px' }} /> 
                    {country}
                  </span>
                  <span style={{ fontWeight: 'bold', color: 'var(--text-secondary)' }}>{count.toLocaleString()}</span>
                </li>
              ))}
            </ul>

            <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', marginTop: '1.5rem' }}>Top Modes de Jeu</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {topGameModes.map(([mode, count]) => (
                <li key={mode} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', fontSize: '0.9rem' }}>
                  <span style={{ textTransform: 'capitalize' }}>{mode}</span>
                  <span style={{ fontWeight: 'bold', color: 'var(--text-secondary)' }}>{count.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </div>
          
          <div className="glass-panel">
            <h2 style={{ marginBottom: '1rem', fontSize: '1.2rem' }}>Sources du Scraper Fantôme</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Le robot aspire automatiquement les serveurs depuis ces sites communautaires :
            </p>
            <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <li style={{ marginBottom: '10px' }}>
                <a href="https://minecraftpocket-servers.com/" target="_blank" rel="noopener noreferrer" style={{ color: '#f59e0b', textDecoration: 'none' }}>🌐 minecraftpocket-servers.com</a>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
