"""
Vela — FastAPI application entry point.
"""
import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings
from app.routers import auth, portfolio, watchlist, markets, macro, imports, quotes, goals, news, networth, cashflow, screener, journal, fx, kv, ai, sentiment, thesis, journey, closed, calibration

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


# ── Rate limiting ────────────────────────────────────────────────────────────

try:
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.util import get_remote_address
    from slowapi.errors import RateLimitExceeded

    limiter = Limiter(
        key_func=get_remote_address,
        default_limits=["200/minute"],
        storage_uri=settings.REDIS_URL,
    )
    _rate_limiter_available = True
except ImportError:
    limiter = None  # type: ignore
    _rate_limiter_available = False
    logger.warning("slowapi not installed — rate limiting disabled")


# ── Security headers middleware ──────────────────────────────────────────────

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses."""

    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        if not settings.DEBUG:
            response.headers["Strict-Transport-Security"] = (
                "max-age=63072000; includeSubDomains; preload"
            )
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; frame-ancestors 'none'"
            )
        return response


# ── App lifecycle ────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Vela API starting up — env: %s", settings.APP_ENV)
    asyncio.create_task(screener._warm_screener_cache())
    yield
    logger.info("Vela API shutting down")


app = FastAPI(
    title="Vela API",
    description="Wealth management platform API — portfolio tracking, valuation tools, and market data.",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

# ── Rate limiting ────────────────────────────────────────────────────────────

if _rate_limiter_available and limiter is not None:
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore[arg-type]

# ── Security headers ─────────────────────────────────────────────────────────

app.add_middleware(SecurityHeadersMiddleware)

# ── CORS ─────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With"],
    max_age=600,
)

# ── Routers ──────────────────────────────────────────────────────────────────

PREFIX = settings.API_PREFIX

app.include_router(auth.router,      prefix=PREFIX, tags=["auth"])
app.include_router(portfolio.router, prefix=PREFIX, tags=["portfolio"])
app.include_router(watchlist.router, prefix=PREFIX, tags=["watchlist"])
app.include_router(markets.router,   prefix=PREFIX, tags=["markets"])
app.include_router(macro.router,     prefix=PREFIX, tags=["macro"])
app.include_router(imports.router,   prefix=PREFIX, tags=["imports"])
app.include_router(quotes.router,    prefix=PREFIX, tags=["quotes"])
app.include_router(goals.router,     prefix=PREFIX, tags=["goals"])
app.include_router(news.router,      prefix=PREFIX, tags=["news"])
app.include_router(networth.router,  prefix=PREFIX, tags=["net-worth"])
app.include_router(cashflow.router, prefix=PREFIX, tags=["cash-flow"])
app.include_router(screener.router, prefix=PREFIX, tags=["screener"])
app.include_router(journal.router,  prefix=PREFIX, tags=["journal"])
app.include_router(fx.router,       prefix=PREFIX, tags=["fx"])
app.include_router(kv.router,       prefix=PREFIX, tags=["kv"])
app.include_router(ai.router,       prefix=PREFIX, tags=["ai"])
app.include_router(sentiment.router, prefix=PREFIX, tags=["sentiment"])
app.include_router(thesis.router,    prefix=PREFIX, tags=["thesis"])
app.include_router(journey.router,   prefix=PREFIX, tags=["journey"])
app.include_router(closed.router,    prefix=PREFIX, tags=["closed"])
app.include_router(calibration.router, prefix=PREFIX, tags=["calibration"])


# ── Health check ─────────────────────────────────────────────────────────────

@app.get("/health", include_in_schema=False)
async def health():
    return JSONResponse({"status": "ok", "app": "vela"})
