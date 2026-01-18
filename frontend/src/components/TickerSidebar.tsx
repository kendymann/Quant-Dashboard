"use client";
import { useEffect, useState } from 'react';

interface TickerSidebarProps {
  selectedTicker: string;
  onTickerSelect: (ticker: string) => void;
}

export const TickerSidebar = ({ selectedTicker, onTickerSelect }: TickerSidebarProps) => {
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const [tickers, setTickers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/tickers`)
      .then(res => res.json())
      .then(json => {
        if (json.error) {
          console.error('API Error:', json.error);
          return;
        }
        setTickers(json.tickers || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Fetch Error:', err);
        setLoading(false);
      });
  }, [API_BASE_URL]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <div style={{ padding: 'var(--space-md) var(--space-sm)' }}>
        {loading ? (
          <div className="label-micro animate-pulse-subtle" style={{ textAlign: 'center' }}>
            ...
          </div>
        ) : (
          <div className="stagger-children">
            {tickers.map((ticker) => (
              <button
                key={ticker}
                onClick={() => onTickerSelect(ticker)}
                className={`ticker-btn animate-fade-in ${selectedTicker === ticker ? 'selected' : ''}`}
              >
                {ticker}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
