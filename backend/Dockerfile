# Use a slim Python image for a smaller footprint
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Copy only requirements first to leverage Docker caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of your FastAPI code
COPY . .

# Expose the port FastAPI runs on
EXPOSE 8000

# Run the app with Uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]