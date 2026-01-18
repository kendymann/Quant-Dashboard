from datetime import timedelta
from airflow import DAG
from airflow.operators.python import PythonOperator
import pendulum # Better timezone handling than standard datetime
from airflow.utils.trigger_rule import TriggerRule

# Imports from your existing scripts (PYTHONPATH=/opt/airflow/scripts)
from extract import extract_market_data
from transform import transform_market_data
from load import load_to_postgres
from factor_analysis import calculate_factors
from validate import auto_repair_data

# Set the timezone to Vancouver
local_tz = pendulum.timezone("America/Vancouver")

default_args = {
    'owner': 'jayden',
    'retries': 2,
    'retry_delay': timedelta(minutes=5),
    # Start date in local time
    'start_date': pendulum.datetime(2024, 1, 1, tz=local_tz),
}

with DAG(
    'morning_quant_pipeline',
    default_args=default_args,
    # This now means 7:00 AM Vancouver time, Monday-Friday
    schedule_interval='0 6 * * 1-5', 
    catchup=False,
    max_active_runs=1
) as dag:

    extract_task = PythonOperator(
        task_id='extract_market_data',
        python_callable=extract_market_data
    )

    transform_task = PythonOperator(
        task_id='transform_market_data',
        python_callable=transform_market_data
    )

    load_task = PythonOperator(
        task_id='load_to_postgres',
        python_callable=load_to_postgres
    )
    
    factor_task = PythonOperator(
        task_id='calculate_factors',
        python_callable=calculate_factors,
        trigger_rule=TriggerRule.NONE_FAILED
    )

    validate_task = PythonOperator(
        task_id='validate_and_repair_data',
        python_callable=auto_repair_data
    )

    # The flow remains exactly the same
    extract_task >> transform_task >> load_task >> factor_task >> validate_task