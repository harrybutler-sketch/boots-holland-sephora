import React, { useState, useEffect } from 'react';

const NewsFeed = () => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Fetch Logic
    const fetchNewsResults = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/news-results');
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || errorData.details || 'Failed to fetch news data');
            }
            const data = await response.json();
            setItems(data);
        } catch (err) {
            console.error('Error fetching News data:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNewsResults();
    }, []);

    const toggleDealtWith = (id) => {
        setItems(items.map(item =>
            item.id === id ? { ...item, dealtWith: !item.dealtWith } : item
        ));
    };

    const runScrape = async () => {
        const proceed = window.confirm("Start a new News Scrape? This will search news outlets for FMCG and beauty announcements and may take a few minutes.");
        if (!proceed) return;

        try {
            alert('Scrape Started! Please check back in a few minutes.');
            await fetch('/api/run-news-scrape', { method: 'POST' });
        } catch (e) {
            alert('Failed to start scrape');
        }
    };

    const exportCSV = () => {
        if (items.length === 0) {
            alert('No data to export.');
            return;
        }

        const headers = ['Source', 'Brand', 'Product', 'Headline', 'Date', 'Article URL'];
        const csvContent = [
            headers.join(','),
            ...items.map(item => [
                `"${item.source ? item.source.replace(/"/g, '""') : 'Unknown'}"`,
                `"${item.brand ? item.brand.replace(/"/g, '""') : 'Unknown'}"`,
                `"${item.product ? item.product.replace(/"/g, '""') : 'Unknown'}"`,
                `"${item.headline ? item.headline.replace(/"/g, '""') : 'Unknown'}"`,
                `"${item.date ? item.date.replace(/"/g, '""') : 'Unknown'}"`,
                `"${item.articleUrl ? item.articleUrl.replace(/"/g, '""') : ''}"`
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `news_scraper_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading News Feed...</div>;

    return (
        <div className="linkedin-feed">
            <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-outline" onClick={exportCSV} disabled={items.length === 0}>
                        📥 Export CSV
                    </button>
                    <button className="btn" onClick={runScrape}>
                        🔄 Run News Scraper
                    </button>
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

            {!error && items.length === 0 && (
                <div className="empty-state">
                    No news articles found. Try running a scrape.
                </div>
            )}

            {!error && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '2rem' }}>
                    {items.map(item => (
                        <div key={item.id} className="card" style={{ opacity: item.dealtWith ? 0.6 : 1, transition: 'opacity 0.2s', display: 'flex', flexDirection: 'column' }}>
                            {/* Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <span className="badge badge-retailer" style={{ textTransform: 'uppercase', background: '#dbeafe', color: '#1e40af' }}>{item.source}</span>
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
                            <div style={{ marginBottom: '1rem' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {item.brand}
                                </div>
                                <h3 style={{ margin: '0.25rem 0', fontSize: '1.25rem', fontWeight: 'bold' }}>
                                    {item.product}
                                </h3>
                            </div>

                            {/* Headline */}
                            <div style={{
                                background: '#f8fafc',
                                padding: '1rem',
                                borderRadius: '8px',
                                borderLeft: '4px solid #3b82f6',
                                marginBottom: '1.5rem',
                                fontStyle: 'italic',
                                color: 'var(--color-text-secondary)',
                                flexGrow: 1
                            }}>
                                <strong style={{ color: '#1e293b', fontStyle: 'normal', display: 'block', marginBottom: '0.5rem' }}>{item.headline}</strong>
                                {item.snippet}
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: 'auto' }}>
                                <button className="btn" style={{ width: '100%', background: 'var(--color-slate)', color: 'white' }}>
                                    OUTREACH LAB
                                </button>
                                <a href={item.articleUrl} target="_blank" rel="noopener noreferrer"
                                    style={{ textAlign: 'center', fontSize: '0.8rem', fontWeight: 'bold', color: '#94a3b8', textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Read Full Article
                                </a>
                            </div>

                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default NewsFeed;
