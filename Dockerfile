# Serie IV · imagen de la API de campo. La misma imagen corre la API (local o Cloud Run) y las pruebas.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /app

COPY api/requirements.txt api/requirements.txt
RUN pip install -r api/requirements.txt

# Solo lo que la API y sus pruebas necesitan: código, artefactos JSON y tablas de control (sin datasets ni notebooks)
COPY src src
COPY api api
COPY outputs/models outputs/models
COPY outputs/tables outputs/tables
COPY sql sql
COPY tests tests
COPY pytest.ini .

RUN useradd --create-home app && chown -R app /app
USER app

EXPOSE 8000
# Cloud Run define PORT; en local se usa 8000
CMD ["sh", "-c", "uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
