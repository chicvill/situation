# Python-only image: serves pre-built frontend dist from git
FROM python:3.11-slim

WORKDIR /app

# Backend dependencies
COPY situation-backend/requirements.txt ./situation-backend/
RUN pip install --no-cache-dir -r ./situation-backend/requirements.txt

# Copy backend source
COPY situation-backend/ ./situation-backend/

# Copy pre-built frontend (built locally, committed to git)
COPY situation-room/dist/ ./situation-room/dist/

EXPOSE 8000

WORKDIR /app/situation-backend
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
