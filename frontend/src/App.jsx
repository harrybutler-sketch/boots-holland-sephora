import React, { useState, useEffect, useCallback } from 'react';
import Controls from './components/Controls';
import Filters from './components/Filters';
import ResultsTable from './components/ResultsTable';
import LinkedinFeed from './components/LinkedinFeed';

function App() {
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard' or 'linkedin'
  const [workspace, setWorkspace] = useState(() => localStorage.getItem('scraper_workspace') || 'beauty'); // 'beauty' or 'grocery'
  const [runStatus, setRunStatus] = useState(() => localStorage.getItem('scraper_runStatus') || 'Idle');
  const [runId, setRunId] = useState(() => localStorage.getItem('scraper_runId') || null);
  const [lastRunTime, setLastRunTime] = useState(null);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    retailer: 'All',
    days: '28',
    q: '',
    review_range: ''
  });

  // Persist State Changes
  useEffect(() => {
    localStorage.setItem('scraper_workspace', workspace);
  }, [workspace]);

  useEffect(() => {
    if (runId) {
      localStorage.setItem('scraper_runId', runId);
    } else {
      localStorage.removeItem('scraper_runId');
    }
  }, [runId]);

  useEffect(() => {
    localStorage.setItem('scraper_runStatus', runStatus);
  }, [runStatus]);


  // Fetch Results
  const fetchResults = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        limit: '5000',
        retailer: filters.retailer,
        days: filters.days,
        q: filters.q,
        review_range: filters.review_range,
        workspace: workspace
      });

      const response = await fetch(`/api/results?${queryParams}`);
      const result = await response.json();

      if (Array.isArray(result)) {
        setData(result);
      } else {
        console.error('Failed to fetch results:', result);
        setData([]);
      }
    } catch (error) {
      console.error('Error fetching results:', error);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [filters, workspace]);

  // Initial Fetch & Filter Change
  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  // Poll Run Status
  useEffect(() => {
    let intervalId;

    if (runStatus === 'RUNNING' && runId) {
      intervalId = setInterval(async () => {
        try {
          const response = await fetch(`/api/run-status?runId=${runId}&workspace=${workspace}`);
          const result = await response.json();

          const terminalStatuses = ['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'];
          if (terminalStatuses.includes(result.status)) {
            setRunStatus(result.status);
            setLastRunTime(new Date().toISOString());
            clearInterval(intervalId);

            // Clear running state from storage
            localStorage.removeItem('scraper_runId');
            localStorage.setItem('scraper_runStatus', result.status);

            // Refresh results on success
            if (result.status === 'SUCCEEDED') {
              fetchResults();
            }
          }
        } catch (error) {
          console.error('Error polling status:', error);
        }
      }, 4000); // 4 seconds poll stats
    }

    return () => clearInterval(intervalId);
  }, [runStatus, runId, fetchResults, workspace]);

  const [selectedRetailers, setSelectedRetailers] = useState({
    'Sephora': true,
    'Holland & Barrett': true,
    'Boots': true,
    'Superdrug': true,
    'Sainsburys': true,
    'Tesco': true,
    'Asda': true,
    'Morrisons': true,
    'Ocado': true,
    'Waitrose': true
  });

  const handleRunScrape = async () => {
    // Get list of selected retailers based on workspace
    const beautyRetailers = ['Sephora', 'Holland & Barrett', 'Boots', 'Superdrug'];
    const groceryRetailers = ['Sainsburys', 'Tesco', 'Asda', 'Morrisons', 'Ocado', 'Waitrose'];

    const activeWorkspaceRetailers = workspace === 'beauty' ? beautyRetailers : groceryRetailers;
    const activeRetailers = activeWorkspaceRetailers.filter(r => selectedRetailers[r]);

    if (activeRetailers.length === 0) {
      alert('Please select at least one retailer to scrape.');
      return;
    }

    setRunStatus('RUNNING');
    try {
      const response = await fetch('/api/run-scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          retailers: activeRetailers,
          mode: 'new-in',
          workspace: workspace
        })
      });
      const result = await response.json();

      if (result.runId) {
        setRunId(result.runId);
      } else {
        setRunStatus('FAILED');
        alert('Failed to start scrape: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error starting scrape:', error);
      setRunStatus('FAILED');
      alert('Error starting scrape. Check console.');
    }
  };

  const handleReset = () => {
    setRunStatus('Idle');
    setRunId(null);
    setData([]);
    setFilters({
      retailer: 'All',
      days: '28',
      q: '',
      max_reviews: ''
    });
  };

  const handleExportCSV = () => {
    if (data.length === 0) {
      alert('No data to export.');
      return;
    }

    const headers = ['Date Found', 'Retailer', 'Manufacturer', 'Product', 'Price', 'Rating', 'Review Count', 'Product URL', 'Image URL'];
    const csvContent = [
      headers.join(','),
      ...data.map(item => [
        item.date_found,
        `"${item.retailer}"`,
        `"${item.manufacturer}"`,
        `"${item.product_name.replace(/"/g, '""')}"`,
        `"${item.price_display}"`,
        item.rating,
        item.reviews,
        `"${item.product_url}"`,
        `"${item.image_url}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `scraper_export_${workspace}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  return (
    <div className="container">
      <header style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '1rem' }}>
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>Brand Allies Scraper</h1>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--color-border)', width: '100%' }}>
          <button
            onClick={() => setCurrentView('dashboard')}
            style={{
              padding: '0.75rem 1rem',
              background: 'none',
              border: 'none',
              borderBottom: currentView === 'dashboard' ? '2px solid var(--color-accent)' : '2px solid transparent',
              color: currentView === 'dashboard' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              fontWeight: currentView === 'dashboard' ? '600' : '500',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            Scraper Dashboard
          </button>
          <button
            onClick={() => setCurrentView('linkedin')}
            style={{
              padding: '0.75rem 1rem',
              background: 'none',
              border: 'none',
              borderBottom: currentView === 'linkedin' ? '2px solid var(--color-accent)' : '2px solid transparent',
              color: currentView === 'linkedin' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              fontWeight: currentView === 'linkedin' ? '600' : '500',
              cursor: 'pointer',
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>LinkedIn Scraper</span>
            <span style={{ fontSize: '0.7rem', background: '#e0e7ff', color: '#4338ca', padding: '2px 6px', borderRadius: '4px' }}>BETA</span>
          </button>
        </div>
      </header>

      {runStatus === 'RUNNING' && (
        <div style={{
          backgroundColor: '#fff3cd',
          color: '#856404',
          padding: '12px',
          borderRadius: '4px',
          marginBottom: '20px',
          border: '1px solid #ffeeba',
          textAlign: 'center'
        }}>
          ⚠️ <strong>Scraping in progress.</strong> Please keep this tab open to ensure data is saved to Google Sheets.
          <br />
          <small>If you close this tab, the scraper will finish but data won't be synced.</small>
        </div>
      )}

      {currentView === 'dashboard' ? (
        <>
          <Controls
            workspace={workspace}
            onWorkspaceChange={(ws) => {
              setWorkspace(ws);
              setFilters(f => ({ ...f, retailer: 'All' }));
            }}
            runStatus={runStatus}
            lastRun={lastRunTime}
            onRunScrape={handleRunScrape}
            onReset={handleReset}
            onExportCSV={handleExportCSV}
            selectedRetailers={selectedRetailers}
            onToggleRetailer={(retailer) => setSelectedRetailers(prev => ({ ...prev, [retailer]: !prev[retailer] }))}
            onTestConnection={async () => {
              const proceed = window.confirm("Run a connection test? This will add a 'Netlify Test' row to your Google Sheet.");
              if (!proceed) return;
              try {
                const res = await fetch('/api/test-connection');
                const data = await res.json();
                alert(JSON.stringify(data, null, 2));
              } catch (e) {
                alert('Test Failed: ' + e.message);
              }
            }}
          />

          <Filters
            workspace={workspace}
            filters={filters}
            onFilterChange={setFilters}
          />

          <ResultsTable
            data={data}
            loading={loading}
            onToggleStatus={async (url, newStatus) => {
              // Optimistic update
              setData(prev => prev.map(item =>
                item.product_url === url ? { ...item, status: newStatus } : item
              ));

              try {
                await fetch('/api/update-status', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ productUrl: url, status: newStatus })
                });
              } catch (e) {
                console.error('Failed to update status:', e);
                // Revert on error
                fetchResults();
              }
            }}
          />
        </>
      ) : (
        <LinkedinFeed />
      )}
    </div>
  );
}

export default App;
