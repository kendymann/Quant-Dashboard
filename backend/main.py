from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import psycopg2
import os

app = FastAPI()

# CORS: Allow frontend origins (localhost for dev, wildcard for Coolify deployment)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for Coolify deployment
    allow_methods=["*"],
    allow_headers=["*"],
)

from dotenv import load_dotenv

# Load local .env file if it exists
load_dotenv()

# Fetch from environment variable, with a fallback for local dev
DB_URL = os.getenv("MARKET_DB_URL", "postgresql://app:K3ndyman2026@localhost:5433/market")

@app.get("/api/tickers")
async def get_tickers():
    """Return a unique list of all tickers in raw.price_ohlcv"""
    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        
        query = """
            SELECT DISTINCT ticker 
            FROM raw.price_ohlcv 
            ORDER BY ticker ASC;
        """
        cur.execute(query)
        rows = cur.fetchall()
        
        # Extract ticker strings from tuples
        tickers = [row[0] for row in rows]
        
        cur.close()
        conn.close()
        
        return {"tickers": tickers}
        
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/prices/{ticker}")
async def get_prices(ticker: str):
    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        
        # Inner JOIN between raw.price_ohlcv and analytics.factors
        # Bridge Raw and Silver data using both date and ticker as join keys
        query = """
            SELECT 
                r.date,
                r.open,
                r.high,
                r.low,
                r.close,
                r.volume,
                f.sma_20,
                f.bollinger_upper,
                f.bollinger_lower,
                f.rsi_14,
                f.log_return,
                f.volatility_20d
            FROM raw.price_ohlcv r
            INNER JOIN analytics.factors f 
                ON r.date = f.date AND r.ticker = f.ticker
            WHERE r.ticker = %s 
            ORDER BY r.date ASC;
        """
        cur.execute(query, (ticker.upper(),))
        rows = cur.fetchall()
        
        # JSON response keys exactly match lowercase Postgres column names
        # Cast all numeric values to float, date as string
        data = [
            {
                "time": str(r[0]),  # Date as string
                "open": float(r[1]) if r[1] is not None else None,
                "high": float(r[2]) if r[2] is not None else None,
                "low": float(r[3]) if r[3] is not None else None,
                "close": float(r[4]) if r[4] is not None else None,
                "volume": int(r[5]) if r[5] is not None else None,
                "sma_20": float(r[6]) if r[6] is not None else None,
                "bollinger_upper": float(r[7]) if r[7] is not None else None,
                "bollinger_lower": float(r[8]) if r[8] is not None else None,
                "rsi_14": float(r[9]) if r[9] is not None else None,
                "log_return": float(r[10]) if r[10] is not None else None,
                "volatility_20d": float(r[11]) if r[11] is not None else None,
            } for r in rows
        ]
        
        cur.close()
        conn.close()
        
        return data
        
    except Exception as e:
        return {"error": str(e)}