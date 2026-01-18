# Quantium Labs

A financial analytics dashboard for viewing stock prices, technical indicators, and benchmark comparisons.

## Tech Stack

- Frontend: Next.js, lightweight-charts
- Backend: FastAPI, PostgreSQL
- Data Pipeline: Airflow with yfinance

## Local Development

1. Clone the repo and start all services:

```bash
docker compose up --build
```

2. Access the apps:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8001
   - Airflow: http://localhost:8080 (admin/admin)

3. Run the Airflow DAG to populate data, or it will run automatically on schedule.

## Environment Variables

Set these in your deployment platform or `.env` file:

| Variable | Description |
|----------|-------------|
| `MARKET_DB_URL` | PostgreSQL connection string |
| `NEXT_PUBLIC_API_URL` | Backend API URL for frontend |
| `POSTGRES_PASSWORD` | Database password |
| `AIRFLOW__DATABASE__SQL_ALCHEMY_CONN` | Airflow DB connection |

## Project Structure

```
backend/          FastAPI server
frontend/         Next.js dashboard
airflow/          ETL pipeline (extract, transform, load)
postgres/         Database init script
docker-compose.yaml
```

## Deployment

Works with Docker Compose on any platform. Tested with Coolify on Hetzner.

Push to your repo and redeploy. The database schema is created automatically on first run via `postgres/init.sql`.
