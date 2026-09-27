# Base image matches the local dev venv (Python 3.13) rather than the older
# 3.12 default. requirements.txt was resolved against 3.13 locally, and every
# compiled dependency (asyncpg, psycopg2-binary, cryptography, pydantic-core,
# numpy, scipy) ships a manylinux wheel for cp313, so there is no version-skew
# risk and no need to compile anything from source.
FROM python:3.13-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# No build-essential: every compiled dependency above ships a manylinux wheel
# for this image's Python/arch, so pip installs pure binaries and there is
# nothing to compile. Verified against PyPI for cp313 manylinux2014_x86_64.
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
