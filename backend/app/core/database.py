from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings
import ssl as ssl_module

# Strip sslmode/ssl from URL (asyncpg doesn't support them as URL params)
db_url = settings.DATABASE_URL
# Remove ?sslmode=require or ?ssl=require or &sslmode=require etc.
clean_url = db_url.split("?")[0] if "?" in db_url else db_url

# Detect if we need SSL (production = Neon)
need_ssl = "neon.tech" in db_url or "sslmode" in db_url or "ssl" in db_url

# Build connect_args
connect_args = {}
if need_ssl:
    ssl_ctx = ssl_module.create_default_context()
    ssl_ctx.check_hostname = False
    ssl_ctx.verify_mode = ssl_module.CERT_NONE
    connect_args["ssl"] = ssl_ctx

# Async engine — connects to PostgreSQL via asyncpg
engine = create_async_engine(
    clean_url,
    echo=settings.APP_DEBUG,  # Log SQL queries in dev
    pool_size=5,
    max_overflow=10,
    connect_args=connect_args,
)

# Session factory — creates new DB sessions
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


# Base class for all ORM models
class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    """Dependency that yields a database session."""
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
