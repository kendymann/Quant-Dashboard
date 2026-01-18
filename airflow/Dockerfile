# Custom Airflow image with DAGs baked in
FROM apache/airflow:2.10.0-python3.11

# Install Python dependencies first (as airflow user)
COPY --chown=airflow:root requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

# Copy DAGs and scripts into the image
COPY --chown=airflow:root dags/ /opt/airflow/dags/
COPY --chown=airflow:root scripts/ /opt/airflow/scripts/

# Set PYTHONPATH for ETL imports
ENV PYTHONPATH=/opt/airflow/scripts
