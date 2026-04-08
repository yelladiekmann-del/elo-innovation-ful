FROM python:3.11-slim
WORKDIR /app
COPY elo-innovation/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY elo-innovation/ .
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
