# scripts/load.py
from sqlalchemy import create_engine, text
import pandas as pd
import os
import logging

logger = logging.getLogger(__name__)

# Primary Loading Task
def load_to_postgres(**context):
    # Pull Clean Path
    clean_path = context['ti'].xcom_pull(task_ids='transform_market_data')
    
    if not clean_path or not os.path.exists(clean_path):
        raise FileNotFoundError(f"Clean file not found at {clean_path}")

    # Database Connection
    db_url = os.environ.get("MARKET_DB_URL")
    engine = create_engine(db_url, pool_pre_ping=True)
    df = pd.read_csv(clean_path)
    
    # Bulk Upsert Logic
    with engine.begin() as conn:
        # Convert DF to list of dicts for SQLAlchemy
        records = df.to_dict(orient='records')
        
        # Execute the SQL with ON CONFLICT (Upsert)
        conn.execute(text("""
            INSERT INTO raw.price_ohlcv 
                (ticker, date, open, high, low, close, adj_close, volume)
            VALUES 
                (:ticker, :date, :open, :high, :low, :close, :adj_close, :volume)
            ON CONFLICT (ticker, date) DO UPDATE SET
                open = EXCLUDED.open,
                high = EXCLUDED.high,
                low = EXCLUDED.low,
                close = EXCLUDED.close,
                adj_close = EXCLUDED.adj_close,
                volume = EXCLUDED.volume,
                load_ts = now();
        """), records)

        # Update the State Cursor
        max_date = df['date'].max()
        conn.execute(text("""
            INSERT INTO system.state (key, value_text, updated_at)
            VALUES ('last_loaded_date', :date_val, now())
            ON CONFLICT (key) DO UPDATE 
            SET value_text = EXCLUDED.value_text, updated_at = EXCLUDED.updated_at;
        """), {"date_val": max_date})
        
    logger.info(f"Successfully loaded {len(records)} records to Postgres.")
