import psycopg2
import yfinance as yf
import os
import logging
from datetime import datetime, timedelta

# Setup logging to see output in Airflow
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

def get_db_connection():
    """
    Get database connection using the Coolify MARKET_DB_URL.
    This replaces the need for separate host/user/pass variables.
    """
    db_url = os.environ.get("MARKET_DB_URL")
    
    if not db_url:
        logger.error("MARKET_DB_URL environment variable not found!")
        raise ValueError("Missing MARKET_DB_URL")

    # Psycopg2 requires 'postgresql://', but SQLAlchemy sometimes uses 'postgresql+psycopg2://'
    if "postgresql+psycopg2://" in db_url:
        db_url = db_url.replace("postgresql+psycopg2://", "postgresql://")
        
    return psycopg2.connect(db_url)

def auto_repair_data():
    """
    Main logic: Identify gaps where SPY has data but others don't, 
    then fetch and insert missing points.
    """
    conn = None
    cur = None
    
    try:
        logger.info("Connecting to database for validation check...")
        conn = get_db_connection()
        cur = conn.cursor()
        
        # 1. Get the list of all tickers except the reference (SPY)
        cur.execute("SELECT DISTINCT ticker FROM raw.price_ohlcv WHERE ticker != %s;", ('SPY',))
        tickers = [row[0] for row in cur.fetchall()]
        
        if not tickers:
            logger.info("No tickers found in database to validate.")
            return
        
        for ticker in tickers:
            # 2. Find dates where SPY exists but this ticker doesn't (The Gap Finder)
            query = """
            SELECT s.date 
            FROM (SELECT date FROM raw.price_ohlcv WHERE ticker = 'SPY') s
            LEFT JOIN (SELECT date FROM raw.price_ohlcv WHERE ticker = %s) t 
              ON s.date = t.date
            WHERE t.date IS NULL;
            """
            cur.execute(query, (ticker,))
            missing_dates = [row[0] for row in cur.fetchall()]
            
            if not missing_dates:
                logger.info(f"✅ {ticker} is fully aligned with SPY.")
                continue
                
            logger.warning(f"⚠️ Found {len(missing_dates)} missing days for {ticker}. Starting repair...")
            
            for missing_date in missing_dates:
                # 3. Prepare timeframe for yfinance
                start_str = missing_date.strftime('%Y-%m-%d')
                end_dt = missing_date + timedelta(days=1)
                end_str = end_dt.strftime('%Y-%m-%d')
                
                try:
                    # 4. Download missing data point
                    data = yf.download(ticker, start=start_str, end=end_str, progress=False)
                    
                    if not data.empty:
                        row = data.iloc[0]
                        
                        # Handle Adjusted Close logic
                        adj_close = float(row.get('Adj Close', row.get('Close', row['Close'])))
                        
                        # 5. Insert the missing data
                        insert_query = """
                        INSERT INTO raw.price_ohlcv (ticker, date, open, high, low, close, adj_close, volume)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (ticker, date) DO NOTHING;
                        """
                        cur.execute(insert_query, (
                            ticker, 
                            missing_date, 
                            float(row['Open']), 
                            float(row['High']), 
                            float(row['Low']), 
                            float(row['Close']), 
                            adj_close, 
                            int(row['Volume'])
                        ))
                        logger.info(f"   [FIXED] {ticker} for {start_str}")
                    else:
                        logger.warning(f"   [SKIP] No data found on yfinance for {ticker} on {start_str}")
                        
                except Exception as e:
                    logger.error(f"   [ERROR] Failed to fetch {ticker} on {start_str}: {str(e)}")
                    continue
        
        # Finalize changes
        conn.commit()
        logger.info("✅ Data integrity check and repair completed successfully.")
        
    except psycopg2.Error as e:
        logger.error(f"❌ Database error during validation: {str(e)}")
        if conn:
            conn.rollback()
        raise
    except Exception as e:
        logger.error(f"❌ Unexpected error: {str(e)}")
        if conn:
            conn.rollback()
        raise
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

if __name__ == "__main__":
    auto_repair_data()