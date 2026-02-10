
function Controls({ workspace, onWorkspaceChange, runStatus, lastRun, onRunScrape, onReset, onExportCSV, selectedRetailers, onToggleRetailer, onTestConnection }) {
    const isRunning = runStatus === 'RUNNING';

    // Retailer sets
    const beautyRetailers = ['Sephora', 'Holland & Barrett', 'Boots', 'Superdrug'];
    const groceryRetailers = ['Sainsburys', 'Tesco', 'Asda', 'Morrisons', 'Ocado', 'Waitrose'];
    const activeWorkspaceRetailers = workspace === 'beauty' ? beautyRetailers : groceryRetailers;

    return (
        <div className="card controls">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Workspace Switcher */}
                <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '1rem' }}>
                    <button
                        className={`btn ${workspace === 'beauty' ? 'btn-primary' : ''}`}
                        onClick={() => onWorkspaceChange('beauty')}
                        style={{ backgroundColor: workspace === 'beauty' ? '' : 'transparent', border: workspace === 'beauty' ? '' : '1px solid var(--color-border)' }}
                    >
                        💄 Beauty & Health
                    </button>
                    <button
                        className={`btn ${workspace === 'grocery' ? 'btn-primary' : ''}`}
                        onClick={() => onWorkspaceChange('grocery')}
                        style={{ backgroundColor: workspace === 'grocery' ? '' : 'transparent', border: workspace === 'grocery' ? '' : '1px solid var(--color-border)' }}
                    >
                        🛒 Grocery
                    </button>
                    <div style={{ flex: 1 }}></div>
                    <button
                        className="btn"
                        onClick={onExportCSV}
                        style={{ backgroundColor: 'var(--color-accent)', color: 'white', border: 'none' }}
                    >
                        📥 Export CSV
                    </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button
                            className="btn btn-primary"
                            onClick={onRunScrape}
                            disabled={isRunning}
                        >
                            {isRunning ? 'Scraping...' : `▶ Run ${workspace === 'beauty' ? 'Beauty' : 'Grocery'} Scrape`}
                        </button>

                        <button
                            className="btn"
                            onClick={onReset}
                            disabled={isRunning}
                            style={{
                                backgroundColor: 'transparent',
                                color: 'var(--color-text-secondary)',
                                border: '1px solid var(--color-border)',
                                marginLeft: '0.5rem'
                            }}
                        >
                            ↺ Reset
                        </button>

                        <div style={{ display: 'flex', gap: '1.2rem', marginLeft: '1rem', alignItems: 'center' }}>
                            <button
                                className="btn"
                                onClick={onTestConnection}
                                disabled={isRunning}
                                style={{
                                    backgroundColor: 'transparent',
                                    color: 'var(--color-primary)',
                                    border: '1px solid var(--color-primary)',
                                    fontSize: '0.8rem',
                                    padding: '0.25rem 0.5rem'
                                }}
                            >
                                Test Sheet
                            </button>
                            {selectedRetailers && activeWorkspaceRetailers.map(retailer => (
                                <label key={retailer} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                                    <input
                                        type="checkbox"
                                        checked={!!selectedRetailers[retailer]}
                                        onChange={() => onToggleRetailer(retailer)}
                                        disabled={isRunning}
                                    />
                                    {retailer}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="status-indicator">
                        <span>Status: </span>
                        <span className={`status-dot ${runStatus.toLowerCase()}`}></span>
                        <span className="status-text">{runStatus}</span>
                        {lastRun && <span className="last-run" style={{ marginLeft: '10px', fontSize: '0.8rem', color: '#8899ac' }}>Last: {new Date(lastRun).toLocaleTimeString()}</span>}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Controls;
