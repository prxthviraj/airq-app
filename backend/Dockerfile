# backend/Dockerfile

# Base image: lightweight Python 3.11
FROM python:3.11-slim-bullseye

# Set working directory inside container
WORKDIR /app

# Copy requirements file and install dependencies
COPY app/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy the application code
COPY app /app

# Expose port 8000 for FastAPI
EXPOSE 8000

# Start FastAPI app with uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
