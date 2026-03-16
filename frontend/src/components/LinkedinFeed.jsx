
import React, { useState, useEffect } from 'react';

const LinkedinFeed = ({ onRunLinkedinScrape, runStatus }) => {
    const isRunning = runStatus === 'RUNNING';
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [showLaunches, setShowLaunches] = useState(true);
    const [showOther, setShowOther] = useState(false);

    const [filterRetailer, setFilterRetailer] = useState('All');
    const [filterDate, setFilterDate] = useState('All');

    // Fetch Logic
    const fetchLinkedinResults = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/linkedin-results');
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || errorData.details || 'Failed to fetch data');
            }
            const data = await response.json();
            
            // Sort by date (descending)
            const sortedData = data.sort((a, b) => {
                if (!a.date || a.date === 'Unknown') return 1;
                if (!b.date || b.date === 'Unknown') return -1;
                
                const parseDate = (d) => {
                    const dateObj = new Date(d);
                    if (!isNaN(dateObj.getTime())) return dateObj.getTime();
                    
                    const lower = d.toLowerCase();
                    const num = parseInt(lower);
                    if (!isNaN(num)) {
                        const now = Date.now();
                        let msAgo = 0;
                        if (lower.includes('h')) msAgo = num * 60 * 60 * 1000;
                        else if (lower.includes('d')) msAgo = num * 24 * 60 * 60 * 1000;
                        else if (lower.includes('w')) msAgo = num * 7 * 24 * 60 * 60 * 1000;
                        else if (lower.includes('m') && !lower.includes('min')) msAgo = num * 30 * 24 * 60 * 60 * 1000;
                        return now - msAgo;
                    }
                    return 0;
                };
                
                return parseDate(b.date) - parseDate(a.date);
            });
            
            setItems(sortedData);
        } catch (err) {
            console.error('Error fetching LinkedIn data:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLinkedinResults();
    }, []);

    const toggleDealtWith = async (id) => {
        // Optimistic UI Update
        const targetItem = items.find(item => item.id === id);
        if (!targetItem) return;

        const newDealtStatus = !targetItem.dealtWith;

        setItems(items.map(item =>
            item.id === id ? { ...item, dealtWith: newDealtStatus } : item
        ));

        try {
            const response = await fetch('/api/mark-dealt-sheet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: id,
                    type: 'linkedin',
                    dealtWith: newDealtStatus
                })
            });

            if (!response.ok) {
                // Revert if failed
                setItems(items.map(item =>
                    item.id === id ? { ...item, dealtWith: !newDealtStatus } : item
                ));
                console.error('Failed to update dealt status in Sheets');
            }
        } catch (err) {
            console.error('Error updating status:', err);
            // Revert if failed
            setItems(items.map(item =>
                item.id === id ? { ...item, dealtWith: !newDealtStatus } : item
            ));
        }
    };

    // Filter Items based on Toggles and Filters
    const visibleItems = items.filter(item => {
        if (item.type === 'launch' && !showLaunches) return false;
        if (item.type === 'other' && !showOther) return false;
        if (!item.type && !showLaunches) return false;

        if (filterRetailer !== 'All' && item.retailer !== filterRetailer) {
            return false;
        }

        if (filterDate !== 'All') {
            if (!item.date || item.date === 'Unknown') return false;
            const dateObj = new Date(item.date);
            if (!isNaN(dateObj.getTime())) {
                const cutoff = new Date();
                cutoff.setDate(cutoff.getDate() - parseInt(filterDate));
                if (dateObj < cutoff) return false;
            } else {
                const lower = item.date.toLowerCase();
                const num = parseInt(lower);
                if (!isNaN(num)) {
                    let daysAgo = 0;
                    if (lower.includes('h')) daysAgo = num / 24;
                    else if (lower.includes('d')) daysAgo = num;
                    else if (lower.includes('w')) daysAgo = num * 7;
                    else if (lower.includes('m') && !lower.includes('min')) daysAgo = num * 30;
                    
                    if (daysAgo > parseInt(filterDate)) return false;
                }
            }
        }

        return true;
    });

    const uniqueRetailers = ['All', ...new Set(items.map(i => i.retailer).filter(Boolean))].sort();

    const exportCSV = () => {
        if (visibleItems.length === 0) {
            alert('No data to export.');
            return;
        }

        const headers = ['Poster', 'Brand', 'Product', 'Retailer', 'Date', 'Post URL'];
        const csvContent = [
            headers.join(','),
            ...visibleItems.map(item => [
                `"${item.manufacturer ? item.manufacturer.replace(/"/g, '""') : 'Unknown'}"`,
                `"${item.brand ? item.brand.replace(/"/g, '""') : 'Unknown'}"`,
                `"${item.product ? item.product.replace(/"/g, '""') : 'Unknown'}"`,
                `"${item.retailer ? item.retailer.replace(/"/g, '""') : 'Unknown'}"`,
                `"${item.date ? item.date.replace(/"/g, '""') : 'Unknown'}"`,
                `"${item.postUrl ? item.postUrl.replace(/"/g, '""') : ''}"`
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `linkedin_scraper_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading LinkedIn Feed...</div>;

    return (
        <div className="linkedin-feed">
            <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', userSelect: 'none' }}>
                        <input
                            type="checkbox"
                            checked={showLaunches}
                            onChange={(e) => setShowLaunches(e.target.checked)}
                        />
                        <strong>Product Launches</strong>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', userSelect: 'none' }}>
                        <input
                            type="checkbox"
                            checked={showOther}
                            onChange={(e) => setShowOther(e.target.checked)}
                        />
                        <strong>Other News</strong>
                    </label>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button className="btn btn-outline" onClick={exportCSV} disabled={visibleItems.length === 0}>
                        📥 Export CSV
                    </button>
                    <button 
                        className="btn" 
                        onClick={() => onRunLinkedinScrape('retailer-mentions')} 
                        disabled={isRunning} 
                        style={{ padding: '0.75rem 1.5rem', background: '#4338ca', color: 'white' }}
                    >
                        {isRunning ? 'Scraping...' : '🔗 Scrape Retailer Mentions'}
                    </button>
                    <button 
                        className="btn" 
                        onClick={() => onRunLinkedinScrape('grocer-pages')} 
                        disabled={isRunning} 
                        style={{ padding: '0.75rem 1.5rem', background: '#334155', color: 'white' }}
                    >
                        {isRunning ? 'Scraping...' : '🗞️ Scrape Grocer Pages'}
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', background: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Retailer</label>
                    <select 
                        value={filterRetailer} 
                        onChange={(e) => setFilterRetailer(e.target.value)}
                        className="select"
                        style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)', minWidth: '150px' }}
                    >
                        {uniqueRetailers.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Posted Date</label>
                    <select 
                        value={filterDate} 
                        onChange={(e) => setFilterDate(e.target.value)}
                        className="select"
                        style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)', minWidth: '150px' }}
                    >
                        <option value="All">All Time</option>
                        <option value="1">Last 24 Hours</option>
                        <option value="7">Last 7 Days</option>
                        <option value="14">Last 14 Days</option>
                        <option value="30">Last 30 Days</option>
                    </select>
                </div>
            </div>

            {error && (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'red', background: '#fff0f0', borderRadius: '8px', marginBottom: '1rem' }}>
                    <strong>Error:</strong> {error}
                    <div style={{ fontSize: '0.8rem', marginTop: '0.5rem', color: '#666' }}>
                        Check API keys and Vercel Environment Variables.
                    </div>
                </div>
            )}

            {!error && visibleItems.length === 0 && (
                <div className="empty-state">
                    No items found matching your filters. Try adjusting the toggles or running a scrape.
                </div>
            )}

            {!error && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '2rem' }}>
                    {visibleItems.map(item => (
                        <div key={item.id} className="card" style={{ opacity: item.dealtWith ? 0.6 : 1, transition: 'opacity 0.2s' }}>
                            {/* Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <span className="badge badge-retailer" style={{ textTransform: 'uppercase' }}>{item.retailer}</span>
                                    {item.type === 'other' && <span className="badge" style={{ background: '#cbd5e1', color: '#475569' }}>Other</span>}
                                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        📅 {item.date}
                                    </span>
                                </div>
                                <button
                                    className="btn btn-outline btn-sm"
                                    onClick={() => toggleDealtWith(item.id)}
                                    style={{ fontSize: '0.7rem', padding: '4px 8px', textTransform: 'uppercase' }}
                                >
                                    {item.dealtWith ? 'Undo' : 'Mark Dealt With'}
                                </button>
                            </div>

                            {/* Brand / Product */}
                            <div style={{ marginBottom: '1.5rem' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {item.brand}
                                </div>
                                <h3 style={{ margin: '0.25rem 0', fontSize: '1.25rem', fontWeight: 'bold' }}>
                                    {item.product}
                                </h3>
                                {/* Manufacturer Link */}
                                <div style={{ marginTop: '0.25rem' }}>
                                    <a href={item.manufacturerUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        🏭 {item.manufacturer} ↗
                                    </a>
                                </div>
                            </div>

                            {/* People Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                                <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    <div style={{ fontSize: '0.65rem', fontWeight: '700', color: 'var(--color-turquoise)', textTransform: 'uppercase', marginBottom: '4px' }}>
                                        Managing Dir
                                    </div>
                                    <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{item.managingDirector || 'Unknown'}</div>
                                </div>
                                <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    <div style={{ fontSize: '0.65rem', fontWeight: '700', color: 'var(--color-accent)', textTransform: 'uppercase', marginBottom: '4px' }}>
                                        Marketing Dir
                                    </div>
                                    <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{item.marketingDirector || 'Unknown'}</div>
                                </div>
                            </div>

                            {/* Quote */}
                            <div style={{
                                background: '#f8fafc',
                                padding: '1rem',
                                borderRadius: '0 8px 8px 0',
                                borderLeft: '4px solid var(--color-turquoise)',
                                marginBottom: '1.5rem',
                                fontStyle: 'italic',
                                color: 'var(--color-text-secondary)'
                            }}>
                                {item.postSnippet}
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <button className="btn" style={{ width: '100%', background: 'var(--color-slate)', color: 'white' }}>
                                    OUTREACH LAB
                                </button>
                                <a href={item.postUrl} target="_blank" rel="noopener noreferrer"
                                    style={{ textAlign: 'center', fontSize: '0.8rem', fontWeight: 'bold', color: '#94a3b8', textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    View Linkedin Post
                                </a>
                            </div>

                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default LinkedinFeed;
