import pandas as pd
from sqlalchemy import create_engine
import os
import logging
import numpy as np

logger = logging.getLogger(__name__)

def calculate_factors(**context):
    # Use the same environment variable as load.py
    db_url = os.environ.get("MARKET_DB_URL")
    if not db_url:
        raise ValueError("MARKET_DB_URL environment variable is not set")
        
    engine = create_engine(db_url, pool_pre_ping=True)
    
    # Pull the raw data
    query = "SELECT date, ticker, close FROM raw.price_ohlcv ORDER BY date ASC"
    df = pd.read_sql(query, engine)
    
    if df.empty:
        logger.warning("No data found in raw.price_ohlcv. Skipping factor calculation.")
        return

    # groupby ensures we don't mix AAPL prices with MSFT prices
    df['sma_20'] = df.groupby('ticker')['close'].transform(lambda x: x.rolling(window=20).mean())
    df['daily_return'] = df.groupby('ticker')['close'].transform(lambda x: x.pct_change())

    # Calculate the 20-day Rolling Standard Deviation, different from SMA mean vs std deviation
    df['std_dev'] = df.groupby('ticker')['close'].transform(lambda x: x.rolling(window=20).std())

    # Calculate Upper and Lower Bollinger Bands. Which are just std dev times 2 and added to/subtracted from the SMA
    df['bollinger_upper'] = df['sma_20'] + (df['std_dev'] * 2)
    df['bollinger_lower'] = df['sma_20'] - (df['std_dev'] * 2)
    
    # Clean up: You don't usually need the raw std_dev in the DB just for calcs
    df.drop(columns=['std_dev'], inplace=True)

    # Daily Log Returns - Time series additive and normilizing the dist for further risk analysis
    df['log_return'] = df.groupby('ticker')['close'].transform(lambda x: np.log(x / x.shift(1)))

    # Annualized Volatility (Rolling 20-day) This is the RISK profile of the stock. Higher volatility = more risk.
    df['volatility_20d'] = df.groupby('ticker')['log_return'].transform(
        lambda x: x.rolling(window=20).std() * np.sqrt(252)
    )

    # RSI (14-day) Compares the mag of recent gains to recent losses over a 14 day period. Like a thermometer for momemntum.
    def compute_rsi(series, period=14):
        delta = series.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
        rs = gain / loss
        return 100 - (100 / (1+rs))

    df['rsi_14'] = df.groupby('ticker')['close'].transform(compute_rsi)
    
    # Using 'replace' for now so it builds the table structure automatically
    with engine.begin() as conn:
        df.to_sql('factors', conn, schema='analytics', if_exists='replace', index=False)
    
    logger.info(f"Successfully calculated factors for {len(df)} rows and stored in analytics.factors.")
    return "analytics.factors"