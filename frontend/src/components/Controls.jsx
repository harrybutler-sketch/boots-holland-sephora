import React from 'react';

const Controls = ({ runStatus, lastRun, onRunScrape, onReset }) => {
    const isRunning = runStatus === 'RUNNING';

    return (
        <div className="card controls">
            <button
                className="btn"
                onClick={onRunScrape}
                disabled={isRunning}
            >
                {isRunning ? 'Scraping...' : 'Run Scrape'}
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

            <div className="status-indicator">
                Status:
                <span className={`status-dot ${runStatus.toLowerCase()}`}></span>
                <span>{runStatus}</span>
            </div>

            {lastRun && (
                <div style={{ marginLeft: 'auto', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                    Last run: {new Date(lastRun).toLocaleString()}
                </div>
            )}
        </div>
    );
};

export default Controls;
