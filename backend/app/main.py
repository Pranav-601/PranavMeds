"""FastAPI application entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.v1.drugs import router as drugs_router
from app.api.v1.compare import router as compare_router
from app.api.v1.request_drug import router as request_drug_router

app = FastAPI(
    title="PranavMeds API",
    description="PranavMeds — search, compare, and find affordable medicine alternatives in India.",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS — allow frontend to talk to backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins (no cookies needed)
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routes
app.include_router(drugs_router)
app.include_router(compare_router)
app.include_router(request_drug_router)


@app.get("/health")
async def health_check():
    """Health check endpoint — also used to keep Render from sleeping."""
    return {"status": "ok", "version": "0.1.0"}


@app.get("/")
async def root():
    return {
        "app": "PranavMeds API",
        "version": "0.1.0",
        "docs": "/docs",
        "disclaimer": "This is for informational purposes only. Always consult your doctor.",
    }