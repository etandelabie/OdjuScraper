"use client";

import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Home() {
  const [servers, setServers] = useState([]);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [historyData, setHistoryData] = useState([]);

  // Form state
  const [host, setHost] = useState('');
  const [port, setPort] = useState('5520');
  const [adding, setAdding] = useState(false);

  const fetchServers = async () => {
    try {
      const res = await fetch('/api/servers');
      const data = await res.json();
      if (data.success) {
        setServers(data.servers);
        setTotalPlayers(data.totalPlayers);
        if (data.lastUpdated) {
          setLastUpdated(data.lastUpdated);
        }
      }
      
      const histRes = await fetch('/api/history');
      const histData = await histRes.json();
      if (histData.success && histData.history) {
        // Format history for the chart
        const formattedHistory = histData.history.map(item => ({
            ...item,
            timeLabel: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }));
        setHistoryData(formattedHistory);
      }
    } catch (error) {
      console.error("Failed to fetch servers:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServers();
    // Refresh every 30 seconds
    const interval = setInterval(fetchServers, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleAddServer = async (e) => {
    e.preventDefault();
    if (!host) return;
    
    setAdding(true);
    try {
      const res = await fetch('/api/add_server', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host, port })
      });
      const data = await res.json();
      
      if (data.success) {
        setHost('');
        setPort('5520');
        // Refresh the list immediately
        setLoading(true);
        fetchServers();
      } else {
        alert(data.error || 'Failed to add server');
      }
    } catch (error) {
      console.error(error);
      alert('Error adding server');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="container">
      <header className="header">
        <h1 className="title">Hytale Tracker</h1>
        <p className="subtitle">Real-time status of Hytale community servers</p>
        {lastUpdated && (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem', fontWeight: 'bold' }}>
            Last updated: {new Date(lastUpdated).toLocaleTimeString()}
          </p>
        )}
      </header>

      <div className="dashboard">
        <main>
          <div className="glass-panel">
            <div className="stat-box">
              <div className="stat-value" style={{ fontSize: '2.5rem' }}>
                {loading && servers.length === 0 ? '-' : `${totalPlayers.toLocaleString()} / ${servers.length}`}
              </div>
              <div className="stat-label">Players online / Unique servers</div>
            </div>

            {historyData.length > 0 && (
                <div style={{ marginTop: '2rem', marginBottom: '2rem', height: '250px', width: '100%' }}>
                    <h2 style={{ marginBottom: '1rem' }}>Players Trend</h2>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={historyData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                            <XAxis dataKey="timeLabel" stroke="rgba(255,255,255,0.5)" tick={{fill: 'rgba(255,255,255,0.7)', fontSize: 12}} />
                            <YAxis stroke="rgba(255,255,255,0.5)" tick={{fill: 'rgba(255,255,255,0.7)', fontSize: 12}} />
                            <Tooltip 
                                contentStyle={{ backgroundColor: 'rgba(15,23,42,0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                                itemStyle={{ color: '#0ea5e9', fontWeight: 'bold' }}
                            />
                            <Line type="monotone" dataKey="totalPlayers" name="Players" stroke="#0ea5e9" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#0ea5e9', stroke: '#fff', strokeWidth: 2 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}

            <h2>Active Servers</h2>
            {loading && servers.length === 0 ? (
              <div className="center-content">
                <div className="loader"></div>
              </div>
            ) : (
              <ul className="server-list" style={{ marginTop: '1.5rem' }}>
                {servers.map((server, idx) => (
                  <li key={idx} className="server-item" style={{
                    position: 'relative',
                    overflow: 'hidden',
                    backgroundImage: server.banner ? `linear-gradient(to right, rgba(15, 23, 42, 0.95) 40%, rgba(15, 23, 42, 0.6)), url(${server.banner})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    borderLeft: server.banner ? '4px solid var(--primary)' : undefined
                  }}>
                    <div className="server-info" style={{ display: 'flex', alignItems: 'center', gap: '1rem', zIndex: 1, position: 'relative' }}>
                      {server.logo && (
                        <img src={server.logo} alt={server.name} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.1)' }} />
                      )}
                      <div>
                        <h3 style={{ textShadow: server.banner ? '0 2px 4px rgba(0,0,0,0.8)' : 'none' }}>{server.name || server.host}</h3>
                        <p style={{ textShadow: server.banner ? '0 1px 2px rgba(0,0,0,0.8)' : 'none' }}>{server.host}:{server.port || 5520}</p>
                        {server.status?.motd && server.status.motd !== 'Hytale' && (
                          <p style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>
                            {server.status.motd}
                          </p>
                        )}
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
                    </div>
                  </li>
                ))}
                {servers.length === 0 && !loading && (
                  <p style={{ color: 'var(--text-secondary)' }}>No servers found. Add one to start tracking!</p>
                )}
              </ul>
            )}
          </div>
        </main>

        <aside>
          <div className="glass-panel">
            <h2 style={{ marginBottom: '1.5rem', fontSize: '1.2rem' }}>Track Custom Server</h2>
            <form onSubmit={handleAddServer}>
              <div className="form-group">
                <label>Server IP / Host</label>
                <input 
                  type="text" 
                  placeholder="e.g. play.hytale.com" 
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Port</label>
                <input 
                  type="number" 
                  placeholder="5520" 
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                />
              </div>
              <button type="submit" className="btn" disabled={adding}>
                {adding ? 'Adding...' : 'Add Server'}
              </button>
            </form>
          </div>
          <div className="glass-panel" style={{ marginTop: '1.5rem' }}>
            <h2 style={{ marginBottom: '1rem', fontSize: '1.2rem' }}>Phantom Scraper Sources</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              The bot automatically scrapes servers from these community sites:
            </p>
            <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <li>
                <a href="https://hytale.game/serveurs/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                  <span className="dashicons dashicons-admin-links"></span> hytale.game
                </a>
              </li>
              <li>
                <a href="https://hytaleonlineservers.com/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                  <span className="dashicons dashicons-admin-links"></span> hytaleonlineservers.com
                </a>
              </li>
              <li>
                <a href="https://hytale-servers.com/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                  <span className="dashicons dashicons-admin-links"></span> hytale-servers.com
                </a>
              </li>
              <li>
                <a href="https://top-serveurs.net/hytale" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                  <span className="dashicons dashicons-admin-links"></span> top-serveurs.net
                </a>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
