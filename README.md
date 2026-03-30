# PranavMeds

PranavMeds is a full-stack project with a FastAPI backend and a Next.js frontend for drug information and search.

## Quick start (local)
Backend (from repo root):

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate    # Windows
# or `source .venv/bin/activate` on macOS/Linux
pip install --upgrade pip
pip install poetry
poetry install
uvicorn app.main:app --reload --port 8000
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Docker (if available)
See `docker-compose.yml` at the repository root for services used in development (Postgres, Meilisearch, etc.).

## License
This project is available under the MIT License. See `LICENSE`.
