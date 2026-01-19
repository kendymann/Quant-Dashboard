"use client";
import { useEffect, useState } from 'react';
import { StockChart } from '../components/StockChart';
import { TickerSidebar } from '../components/TickerSidebar';

export default function Home() {
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const [data, setData] = useState<any[]>([]);
  const [spyData, setSpyData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedTicker, setSelectedTicker] = useState<string>('AAPL');
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('ALL');
  
  // Mobile menu state
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  
  // Indicator visibility toggles
  const [showPrice, setShowPrice] = useState<boolean>(true);
  const [showSMA, setShowSMA] = useState<boolean>(true);
  const [showBollinger, setShowBollinger] = useState<boolean>(true);
  const [showSPY, setShowSPY] = useState<boolean>(false);
  
  // Close menu when ticker is selected (mobile UX)
  const handleTickerSelect = (ticker: string) => {
    setSelectedTicker(ticker);
    setMenuOpen(false);
  };

  // Fetch main ticker data
  useEffect(() => {
    setLoading(true);
    // Use the dynamic base URL instead of hardcoded localhost
    fetch(`${API_BASE_URL}/api/prices/${selectedTicker}`)
      .then(res => res.json())
      .then(json => {
        if (json.error) {
          console.error('API Error:', json.error);
          return;
        }
        setData(json);
        setLoading(false);
      })
      .catch(err => {
        console.error('Fetch Error:', err);
        setLoading(false);
      });
  }, [selectedTicker, API_BASE_URL]);

  // Fetch SPY data when comparison is enabled
  useEffect(() => {
    if (showSPY && spyData.length === 0) {
      fetch(`${API_BASE_URL}/api/prices/SPY`)
        .then(res => res.json())
        .then(json => {
          if (json.error) {
            console.error('SPY API Error:', json.error);
            return;
          }
          setSpyData(json);
        })
        .catch(err => console.error('SPY Fetch Error:', err));
    }
  }, [showSPY, spyData.length, API_BASE_URL]);

  // Extract latest technical specs
  const latestData = data.length > 0 ? data[data.length - 1] : null;
  const volatility = latestData?.volatility_20d;
  const logReturn = latestData?.log_return;

  // Format volatility as percentage
  const volatilityFormatted = volatility !== null && volatility !== undefined 
    ? `${(volatility * 100).toFixed(1)}%` 
    : '—';

  // Format log return with signal colors
  const logReturnFormatted = logReturn !== null && logReturn !== undefined
    ? `${logReturn >= 0 ? '+' : ''}${logReturn.toFixed(4)}`
    : '—';
  
  const logReturnClass = logReturn !== null && logReturn !== undefined
    ? (logReturn >= 0 ? 'text-signal-green' : 'text-signal-red')
    : '';

  const timeframes = ['1M', '3M', '1Y', 'YTD', 'ALL'];

  return (
    <main style={{ minHeight: '100vh', display: 'flex' }}>
      {/* Mobile Menu Button */}
      <button 
        className="menu-toggle"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Toggle menu"
      >
        {menuOpen ? '✕' : '☰'}
      </button>
      
      {/* Mobile Overlay */}
      <div 
        className={`sidebar-overlay ${menuOpen ? 'open' : ''}`}
        onClick={() => setMenuOpen(false)}
      />
      
      {/* Sidebar - Fixed left, hairline border */}
      <aside className={`sidebar border-hairline-r ${menuOpen ? 'open' : ''}`}>
        <TickerSidebar 
          selectedTicker={selectedTicker}
          onTickerSelect={handleTickerSelect}
        />
      </aside>

      {/* Main Content Area */}
      <div className="main-content" style={{ flex: 1, marginLeft: '64px' }}>
        <div className="editorial-grid" style={{ maxWidth: '1920px', margin: '0 auto' }}>
          
          {/* Hero Metrics Section */}
          <header 
            className="border-hairline-b metrics-header"
            style={{ 
              gridColumn: '1 / -1', 
              padding: 'var(--space-lg) var(--space-xl)',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 'var(--space-xl)'
            }}
          >
            {/* Volatility */}
            <div className="animate-fade-in metric-wrapper">
              <p className="label-micro" style={{ marginBottom: 'var(--space-sm)' }}>
                VOLATILITY_20D
              </p>
              <p className={`metric-display ${loading ? 'animate-pulse-subtle' : ''}`}>
                {volatilityFormatted}
              </p>
              <div className="metric-tooltip">
                <p>20-Day Annualized Volatility: Measures the standard deviation of daily log returns, scaled to a year. High values indicate higher risk and price swings. 10% is stable; 30%+ is high risk.</p>
              </div>
            </div>

            {/* Log Return */}
            <div className="animate-fade-in metric-wrapper" style={{ animationDelay: '50ms' }}>
              <p className="label-micro" style={{ marginBottom: 'var(--space-sm)' }}>
                LOG_RETURN
              </p>
              <p className={`metric-display ${logReturnClass} ${loading ? 'animate-pulse-subtle' : ''}`}>
                {logReturnFormatted}
              </p>
              <div className="metric-tooltip">
                <p>Daily Log Return: Used for statistical modeling because log returns are additive across time periods.</p>
              </div>
            </div>
          </header>

          {/* Ticker Watermark + Timeframe Controls */}
          <section 
            className="border-hairline-b watermark-section"
            style={{ 
              gridColumn: '1 / -1', 
              padding: 'var(--space-xl) var(--space-xl)',
              position: 'relative',
              minHeight: '160px'
            }}
          >
            {/* Massive Ticker Watermark */}
            <div className="ticker-watermark">
              <span className="ticker-watermark-text">{selectedTicker}</span>
            </div>

            {/* Timeframe Buttons */}
            <nav className="timeframe-nav" style={{ position: 'relative', zIndex: 10, display: 'flex', gap: 'var(--space-lg)' }}>
              {timeframes.map((timeframe) => (
                <button
                  key={timeframe}
                  onClick={() => setSelectedTimeframe(timeframe)}
                  className={`btn-minimal ${selectedTimeframe === timeframe ? 'active' : ''}`}
                >
                  {timeframe}
                </button>
              ))}
            </nav>
          </section>

          {/* Chart Section */}
          <section 
            style={{ 
              gridColumn: '1 / -1', 
              padding: 'var(--space-lg) var(--space-xl)'
            }}
          >
            {data.length > 0 ? (
              <StockChart 
                data={data}
                spyData={spyData}
                selectedTimeframe={selectedTimeframe}
                showPrice={showPrice}
                showSMA={showSMA}
                showBollinger={showBollinger}
                showSPY={showSPY}
                onTogglePrice={() => setShowPrice(!showPrice)}
                onToggleSMA={() => setShowSMA(!showSMA)}
                onToggleBollinger={() => setShowBollinger(!showBollinger)}
                onToggleSPY={() => setShowSPY(!showSPY)}
              />
            ) : (
              <div 
                style={{ 
                  height: '533px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center' 
                }}
              >
                <p className="label-micro animate-pulse-subtle">LOADING</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
