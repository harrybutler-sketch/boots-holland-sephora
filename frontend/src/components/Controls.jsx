import React from 'react';

function Controls({ runStatus, lastRun, onRunScrape, onReset, selectedRetailers, onToggleRetailer }) {
    const isRunning = runStatus === 'RUNNING';

    return (
        <div className="card controls">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button
                        className="btn btn-primary"
                        onClick={onRunScrape}
                        disabled={isRunning}
                    >
                        {isRunning ? 'Scraping...' : '▶ Run Scrape'}
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

                    <div style={{ display: 'flex', gap: '1rem', marginLeft: '1rem', alignItems: 'center' }}>
                        {selectedRetailers && Object.keys(selectedRetailers).map(retailer => (
                            <label key={retailer} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                                <input
                                    type="checkbox"
                                    checked={selectedRetailers[retailer]}
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
    );
}

export default Controls;
