
function Controls({ workspace, onWorkspaceChange, runStatus, lastRun, onRunScrape, onReset, onExportCSV, selectedRetailers, onToggleRetailer, onTestConnection }) {
    const isRunning = runStatus === 'RUNNING';

    // Retailer sets
    const beautyRetailers = ['Sephora', 'Holland & Barrett', 'Boots', 'Superdrug'];
    const groceryRetailers = ['Sainsburys', 'Tesco', 'Asda', 'Morrisons', 'Ocado', 'Waitrose'];
    const linkedinRetailers = [...new Set([...beautyRetailers, ...groceryRetailers, 'The Grocer'])].sort();
    
    const activeWorkspaceRetailers = workspace === 'beauty' ? beautyRetailers : (workspace === 'grocery' ? groceryRetailers : linkedinRetailers);

    return (
        <div className="card controls" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* Workspace Switcher */}
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', background: 'rgba(0,0,0,0.03)', padding: '0.4rem', borderRadius: '9999px' }}>
                        <button
                            onClick={() => onWorkspaceChange('beauty')}
                            style={{
                                padding: '0.625rem 1.25rem',
                                background: workspace === 'beauty' ? 'white' : 'transparent',
                                border: 'none',
                                borderRadius: '9999px',
                                color: workspace === 'beauty' ? 'var(--color-purple)' : 'var(--color-text-secondary)',
                                fontWeight: '600',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                boxShadow: workspace === 'beauty' ? 'var(--shadow-sm)' : 'none',
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                        >
                            <span>💄 Beauty</span>
                        </button>
                        <button
                            onClick={() => onWorkspaceChange('grocery')}
                            style={{
                                padding: '0.625rem 1.25rem',
                                background: workspace === 'grocery' ? 'white' : 'transparent',
                                border: 'none',
                                borderRadius: '9999px',
                                color: workspace === 'grocery' ? 'var(--color-purple)' : 'var(--color-text-secondary)',
                                fontWeight: '600',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                boxShadow: workspace === 'grocery' ? 'var(--shadow-sm)' : 'none',
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                        >
                            <span>🛒 Grocery</span>
                        </button>
                        <button
                            onClick={() => onWorkspaceChange('linkedin')}
                            style={{
                                padding: '0.625rem 1.25rem',
                                background: workspace === 'linkedin' ? 'white' : 'transparent',
                                border: 'none',
                                borderRadius: '9999px',
                                color: workspace === 'linkedin' ? 'var(--color-indigo)' : 'var(--color-text-secondary)',
                                fontWeight: '600',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                boxShadow: workspace === 'linkedin' ? 'var(--shadow-sm)' : 'none',
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                        >
                            <span>🔗 LinkedIn</span>
                        </button>
                    </div>
                    <div style={{ flex: 1 }}></div>
                    <button
                        className="btn"
                        onClick={onExportCSV}
                        style={{ padding: '0.75rem 1.5rem', fontSize: '0.9rem', background: 'white', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}
                    >
                        📥 Export CSV
                    </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                        <button
                            className="btn"
                            onClick={onRunScrape}
                            disabled={isRunning}
                            style={{ minWidth: '200px' }}
                        >
                            {isRunning ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span className="status-dot running" style={{ background: 'white' }}></span>
                                    Scraping...
                                </div>
                            ) : `▶ Scrape Retailers`}
                        </button>

                        <button
                            className="btn"
                            onClick={onReset}
                            style={{
                                backgroundColor: 'transparent',
                                color: 'var(--color-text-secondary)',
                                border: '1px solid var(--color-border)',
                                boxShadow: 'none'
                            }}
                        >
                            ↺ Reset
                        </button>

                        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', background: 'rgba(0,0,0,0.02)', padding: '0.75rem 1.25rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
                            {selectedRetailers && activeWorkspaceRetailers.map(retailer => (
                                <label key={retailer} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '500', color: 'var(--color-text-secondary)' }}>
                                    <input
                                        type="checkbox"
                                        style={{ accentColor: 'var(--color-purple)', width: '16px', height: '16px' }}
                                        checked={!!selectedRetailers[retailer]}
                                        onChange={() => onToggleRetailer(retailer)}
                                        disabled={isRunning}
                                    />
                                    {retailer}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                        <div className="status-indicator" style={{ background: 'rgba(0,0,0,0.03)', padding: '0.5rem 1rem', borderRadius: '9999px', fontSize: '0.9rem' }}>
                            <span style={{ fontWeight: '600' }}>Status: </span>
                            <span className={`status-dot ${runStatus.toLowerCase()}`} style={{ margin: '0 8px' }}></span>
                            <span className="status-text" style={{ textTransform: 'capitalize', fontWeight: '600', color: 'var(--color-text-primary)' }}>{runStatus.toLowerCase()}</span>
                        </div>
                        {lastRun && <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginRight: '0.75rem' }}>Last Run: {new Date(lastRun).toLocaleTimeString()}</span>}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Controls;
