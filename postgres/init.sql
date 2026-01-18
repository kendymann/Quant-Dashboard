-- Initialize schemas and tables for Quant Dashboard
-- This runs automatically on first postgres container startup

-- Create schemas
CREATE SCHEMA IF NOT EXISTS raw;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS system;

-- Raw price data table
CREATE TABLE IF NOT EXISTS raw.price_ohlcv (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    open NUMERIC(12, 4),
    high NUMERIC(12, 4),
    low NUMERIC(12, 4),
    close NUMERIC(12, 4),
    adj_close NUMERIC(12, 4),
    volume BIGINT,
    load_ts TIMESTAMP DEFAULT NOW(),
    UNIQUE (ticker, date)
);

-- Analytics factors table (created by factor_analysis.py, but schema needed)
CREATE TABLE IF NOT EXISTS analytics.factors (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    ticker VARCHAR(10) NOT NULL,
    close NUMERIC(12, 4),
    sma_20 NUMERIC(12, 4),
    daily_return NUMERIC(12, 6),
    bollinger_upper NUMERIC(12, 4),
    bollinger_lower NUMERIC(12, 4),
    log_return NUMERIC(12, 6),
    volatility_20d NUMERIC(12, 6),
    rsi_14 NUMERIC(8, 4),
    UNIQUE (ticker, date)
);

-- System state table (for tracking last loaded date)
CREATE TABLE IF NOT EXISTS system.state (
    key VARCHAR(100) PRIMARY KEY,
    value_text TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_price_ticker_date ON raw.price_ohlcv(ticker, date);
CREATE INDEX IF NOT EXISTS idx_factors_ticker_date ON analytics.factors(ticker, date);

-- Grant permissions (ensure app user can access everything)
GRANT ALL PRIVILEGES ON SCHEMA raw TO app;
GRANT ALL PRIVILEGES ON SCHEMA analytics TO app;
GRANT ALL PRIVILEGES ON SCHEMA system TO app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA raw TO app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA analytics TO app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA system TO app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA raw TO app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA analytics TO app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA system TO app;
