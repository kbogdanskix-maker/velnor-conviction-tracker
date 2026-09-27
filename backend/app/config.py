from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

# Anchor the .env to backend/.env via an absolute path so it loads regardless of
# the process CWD. uvicorn is often launched from a parent dir (e.g. with
# --app-dir), where a relative env_file=".env" would silently resolve to nothing
# and leave secrets at their placeholder defaults.
_ENV_PATH = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(_ENV_PATH), env_file_encoding="utf-8", extra="ignore")

    # App
    APP_NAME: str = "Vela"
    APP_ENV: str = "development"
    DEBUG: bool = True
    API_PREFIX: str = "/api/v1"
    # pydantic-settings parses this from a JSON array in the env var, e.g.
    # fly secrets set ALLOWED_ORIGINS='["https://velnor.vercel.app"]' —
    # set once the Vercel URL is known. The localhost entry below is the
    # local-dev default and is only used when the env var is unset.
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000", "https://vela.finance"]

    # Database (Supabase PostgreSQL)
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/vela"
    DATABASE_URL_SYNC: str = "postgresql://postgres:password@localhost:5432/vela"

    # Supabase Auth. Only the URL is needed: tokens are verified against the
    # project's public JWKS (ES256) in core/security.py, so the backend holds no
    # Supabase secret. The anon key lives in the frontend, and service_role is
    # deliberately absent -- nothing here should bypass RLS.
    SUPABASE_URL: str = "https://your-project.supabase.co"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Cloudflare R2
    R2_ACCOUNT_ID: str = "your-account-id"
    R2_ACCESS_KEY_ID: str = "your-access-key-id"
    R2_SECRET_ACCESS_KEY: str = "your-secret-access-key"
    R2_BUCKET_NAME: str = "vela-imports"
    R2_ENDPOINT_URL: str = "https://your-account-id.r2.cloudflarestorage.com"

    # Financial data APIs
    FMP_API_KEY: str = "your-fmp-api-key"
    FRED_API_KEY: str = "your-fred-api-key"
    ALPACA_API_KEY: str = "your-alpaca-api-key"
    ALPACA_API_SECRET: str = "your-alpaca-api-secret"
    NEWSAPI_KEY: str = "your-newsapi-key"
    OPEN_EXCHANGE_RATES_APP_ID: str = "your-openexchangerates-app-id"

    # Social data APIs
    STOCKTWITS_CLIENT_ID: str = "your-stocktwits-client-id"
    STOCKTWITS_CLIENT_SECRET: str = "your-stocktwits-client-secret"
    REDDIT_CLIENT_ID: str = "your-reddit-client-id"
    REDDIT_CLIENT_SECRET: str = "your-reddit-client-secret"
    REDDIT_USER_AGENT: str = "Vela/1.0"
    TWITTER_BEARER_TOKEN: str = "your-twitter-bearer-token"

    # Feature flags
    ENABLE_TWITTER: bool = False  # deferred — $100/mo API cost

    # Notifications
    SENDGRID_API_KEY: str = "your-sendgrid-api-key"
    FROM_EMAIL: str = "hello@vela.finance"

    # Claude API (for AI features)
    ANTHROPIC_API_KEY: str = "your-anthropic-api-key"

    # Deep Dive: operator-authored house style for the research report.
    # Drop a markdown file at this path and it is appended to the prompt.
    # It sits AFTER the no-advice guardrail and cannot relax it.
    DEEP_DIVE_GUIDELINE_PATH: str = "deep_dive_guideline.md"

    # Stripe (billing)
    STRIPE_SECRET_KEY: str = "your-stripe-secret-key"
    STRIPE_WEBHOOK_SECRET: str = "your-stripe-webhook-secret"
    # Pre-launch: hand every account the top tier. Velnor is not being sold,
    # so the paid tiers exist in code but are switched off rather than deleted.
    # Feature-flagging only: this grants no extra DATA access. Every query is
    # still scoped to the caller's own user_id and RLS is untouched.
    # Set to False to re-enable Horizon/Voyager/Navigator.
    UNLOCK_ALL_TIERS: bool = True

    # ── Demo release cost controls ────────────────────────────────────────
    # Velnor's public demo hands every anonymous visitor a Navigator account,
    # and Navigator's AI quota is unlimited. These caps are what stop an
    # unbounded supply of fresh accounts becoming an unbounded bill. Settings
    # rather than constants so they can be raised without a redeploy.
    AI_GLOBAL_DAILY_LIMIT: int = 100
    DEMO_USER_DAILY_AI_LIMIT: int = 5
    DEEP_DIVE_GLOBAL_DAILY_LIMIT: int = 1

    STRIPE_VOYAGER_PRICE_ID: str = "price_voyager"
    STRIPE_NAVIGATOR_PRICE_ID: str = "price_navigator"


    @model_validator(mode="after")
    def _recover_blank_anthropic_key(self) -> "Settings":
        """An empty ANTHROPIC_API_KEY env var (e.g. exported blank in a shell
        profile) takes precedence over the .env file under pydantic's rules,
        silently disabling AI features. If the resolved key is blank, fall back
        to the value in the .env file directly."""
        if not (self.ANTHROPIC_API_KEY or "").strip() and _ENV_PATH.exists():
            for line in _ENV_PATH.read_text(encoding="utf-8").splitlines():
                stripped = line.strip()
                if stripped.startswith("ANTHROPIC_API_KEY=") and not stripped.startswith("#"):
                    value = stripped.split("=", 1)[1].strip().strip('"').strip("'")
                    if value:
                        self.ANTHROPIC_API_KEY = value
                    break
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
