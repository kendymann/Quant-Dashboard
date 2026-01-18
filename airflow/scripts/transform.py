import pandas as pd
import os
import logging
from datetime import date
from airflow.exceptions import AirflowSkipException

logger = logging.getLogger(__name__)

# Data Normalization & Validation
def transform_market_data(**context):
    # Retrieve path from previous task
    raw_path = context['ti'].xcom_pull(task_ids='extract_market_data')
    
    if not raw_path:
        logger.info("No new data path returned from extract task - skipping.")
        raise AirflowSkipException("No new data to process")
    
    if not os.path.exists(raw_path):
        logger.error(f"No raw data file found at path: {raw_path}")
        raise FileNotFoundError(f"File not found: {raw_path}")

    try:
        # Load and Flatten MultiIndex
        # yfinance with group_by='ticker' creates: (Ticker, Metric) columns
        # Example: ('SPY', 'Open'), ('SPY', 'High'), ('AAPL', 'Open'), etc.
        df = pd.read_csv(raw_path, header=[0, 1], index_col=0)
        
        logger.info(f"Loaded CSV with shape: {df.shape}")
        logger.info(f"Column structure: {type(df.columns)}")
        logger.info(f"First few columns: {list(df.columns[:6])}")
        logger.info(f"MultiIndex levels: {df.columns.names}")
        
        # Verify we have MultiIndex columns
        if not isinstance(df.columns, pd.MultiIndex):
            logger.error("Expected MultiIndex columns but got regular columns")
            logger.error(f"Actual columns: {list(df.columns)}")
            raise ValueError("CSV structure doesn't match expected MultiIndex format")
        
        # yfinance with group_by='ticker' creates columns as (Ticker, Metric)
        # Level 0 = Ticker (SPY, AAPL, MSFT, QQQ)
        # Level 1 = Metric (Open, High, Low, Close, Adj Close, Volume)
        # We need to swap levels first, then stack level 1 to get (date, ticker) rows with metric columns
        # Swap to make it (Metric, Ticker), then stack level 1 (tickers)
        df.columns = df.columns.swaplevel(0, 1)
        logger.info(f"After swap levels - first few columns: {list(df.columns[:6])}")
        
        # Now stack level 1 (tickers) to move them to rows
        # This creates: index=(date, ticker), columns=metrics
        df = df.stack(level=1).reset_index()
        
        logger.info(f"After stack - shape: {df.shape}, columns: {list(df.columns)}")
        
        # After stack(level=0):
        # - Index reset creates columns: [date_index_col, level_1 (which is ticker)]
        # - Remaining columns are the metrics: Open, High, Low, Close, Adj Close, Volume
        
        # Rename columns - handle different possible names
        rename_dict = {}
        if df.columns[0] in ['level_0', 'Date', 'date'] or df.columns[0].startswith('Unnamed') or df.index.name == 'Date':
            rename_dict[df.columns[0]] = 'date'
        if len(df.columns) > 1 and df.columns[1] in ['level_1', 'Ticker', 'ticker', 0]:
            rename_dict[df.columns[1]] = 'ticker'
        
        if rename_dict:
            df.rename(columns=rename_dict, inplace=True)
        
        logger.info(f"After rename - columns: {list(df.columns)}")
        
        # Map metric column names to standardized names
        column_map = {
            'Adj Close': 'adj_close',
            'Close': 'close',
            'High': 'high',
            'Low': 'low',
            'Open': 'open',
            'Volume': 'volume',
            # Handle case variations
            'adj close': 'adj_close',
            'Adj close': 'adj_close',
            'close': 'close',
            'high': 'high',
            'low': 'low',
            'open': 'open',
            'volume': 'volume'
        }
        
        # Rename metric columns
        df.rename(columns=column_map, inplace=True)
        
        logger.info(f"After column mapping - columns: {list(df.columns)}")
        
        # Handle missing 'Adj Close' - yfinance with group_by='ticker' doesn't always return it
        # Use 'close' as fallback since adj_close ≈ close for recent data
        if 'adj_close' not in df.columns:
            if 'close' in df.columns:
                logger.warning("Adj Close not found in data, using Close as adj_close")
                df['adj_close'] = df['close']
            else:
                logger.error("Neither Adj Close nor Close found in data")
                raise ValueError("Missing both 'adj_close' and 'close' columns")
        
        # Ensure we have the expected columns
        required_cols = ['date', 'ticker', 'open', 'high', 'low', 'close', 'adj_close', 'volume']
        missing_cols = [col for col in required_cols if col not in df.columns]
        if missing_cols:
            logger.error(f"Missing required columns after transformation: {missing_cols}")
            logger.error(f"Actual columns: {list(df.columns)}")
            logger.error(f"First few rows:\n{df.head()}")
            raise ValueError(f"Missing columns: {missing_cols}. Actual columns: {list(df.columns)}")
        
        # Reorder columns to match expected format
        df = df[required_cols]
        
        # Formatting and Types
        df['date'] = pd.to_datetime(df['date']).dt.date
        numeric_cols = ['open', 'high', 'low', 'close', 'adj_close', 'volume']
        for col in numeric_cols:
            df[col] = pd.to_numeric(df[col], errors='coerce')
        
        # Data Validation
        initial_count = len(df)
        df = df.dropna(subset=['close', 'open'])
        df = df[df['close'] > 0] # Filter out API glitches
        
        logger.info(f"Cleaned {initial_count - len(df)} bad records from {initial_count} total")
        logger.info(f"Final record count: {len(df)}")

        # Persist Clean Data
        clean_path = f"/tmp/clean_market_data_{date.today()}.csv"
        df.to_csv(clean_path, index=False)
        logger.info(f"Saved cleaned data to {clean_path}")
        return clean_path
        
    except Exception as e:
        logger.error(f"Transform failed with error: {str(e)}")
        logger.exception("Full traceback:")
        raise