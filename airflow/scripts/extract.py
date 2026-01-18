import yfinance as yf
import pandas as pd
import os
import logging
from datetime import date, timedelta
from sqlalchemy import create_engine, text

logger = logging.getLogger(__name__)

# State Check Logic
def get_last_date_from_db():
    db_url = os.environ.get("MARKET_DB_URL")
    engine = create_engine(db_url)
    with engine.connect() as conn:
        result = conn.execute(text(
            "SELECT value_text FROM system.state WHERE key='last_loaded_date'"
        )).fetchone()
        return pd.to_datetime(result[0]).date() if result else None

# Primary Extraction Task
def extract_market_data(**context):
    TICKERS = ["SPY", "QQQ", "AAPL", "MSFT"]
    
    # Calculate Date Range
    last_date = get_last_date_from_db()
    start = last_date + timedelta(days=1) if last_date else (date.today() - timedelta(days=365))
    end = date.today()
    
    if start >= end:
        return None

    # Fetch and Persist
    try:
        raw_df = yf.download(TICKERS, start=start, end=end, group_by='ticker', progress=False)
        
        if raw_df.empty:
            raise ValueError("No data returned")

        output_path = f"/tmp/raw_market_data_{date.today()}.csv"
        raw_df.to_csv(output_path)
        return output_path
        
    except Exception as e:
        logger.error(f"Failed: {str(e)}")
        raise e