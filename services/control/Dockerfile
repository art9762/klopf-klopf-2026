FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Copy dependency files first for layer caching
COPY pyproject.toml uv.lock ./

RUN uv sync --frozen --no-install-project

# Copy application source
COPY src/ ./src/
COPY scripts/ ./scripts/

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "control.main:app", "--host", "0.0.0.0", "--port", "8000"]
