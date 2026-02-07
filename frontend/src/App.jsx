import React, { useState, useEffect, useCallback } from 'react';
import Controls from './components/Controls';
import Filters from './components/Filters';
import ResultsTable from './components/ResultsTable';

function App() {
  const [runStatus, setRunStatus] = useState('Idle');
  const [runId, setRunId] = useState(null);
  const [lastRunTime, setLastRunTime] = useState(null);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    retailer: 'All',
    days: '28',
    q: ''
  });

  // Fetch Results
  const fetchResults = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        limit: '200',
        retailer: filters.retailer,
        days: filters.days,
        q: filters.q
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
  }, [filters]);

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
          const response = await fetch(`/api/run-status?runId=${runId}`);
          const result = await response.json();

          if (result.status === 'SUCCEEDED' || result.status === 'FAILED') {
            setRunStatus(result.status);
            setLastRunTime(new Date().toISOString());
            clearInterval(intervalId);
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
  }, [runStatus, runId, fetchResults]);

  const [selectedRetailers, setSelectedRetailers] = useState({
    'Sephora': true,
    'Holland & Barrett': true,
    'Boots': true
  });

  const handleRunScrape = async () => {
    // Get list of selected retailers
    const activeRetailers = Object.keys(selectedRetailers).filter(r => selectedRetailers[r]);

    if (activeRetailers.length === 0) {
      alert('Please select at least one retailer to scrape.');
      return;
    }

    setRunStatus('RUNNING');
    try {
      const response = await fetch('/api/run-scrape', {
        method: 'POST',
        body: JSON.stringify({
          retailers: activeRetailers,
          mode: 'new-in'
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
      q: ''
    });
  };

  return (
    <div className="container">
      <header>
        <h1>Brand Allies Scraper</h1>
      </header>

      <Controls
        runStatus={runStatus}
        lastRun={lastRunTime}
        onRunScrape={handleRunScrape}
        onReset={handleReset}
        selectedRetailers={selectedRetailers}
        onToggleRetailer={(retailer) => setSelectedRetailers(prev => ({ ...prev, [retailer]: !prev[retailer] }))}
      />

      <Filters
        filters={filters}
        onFilterChange={setFilters}
      />

      <ResultsTable
        data={data}
        loading={loading}
      />
    </div>
  );
}

export default App;
