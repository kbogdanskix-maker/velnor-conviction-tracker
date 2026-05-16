from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # App
    APP_NAME: str = "Vela"
    APP_ENV: str = "development"
    DEBUG: bool = True
    API_PREFIX: str = "/api/v1"
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000", "https://vela.finance"]

    # Database (Supabase PostgreSQL)
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/vela"
    DATABASE_URL_SYNC: str = "postgresql://postgres:password@localhost:5432/vela"

    # Supabase Auth
    SUPABASE_URL: str = "https://your-project.supabase.co"
    SUPABASE_ANON_KEY: str = "your-anon-key"
    SUPABASE_SERVICE_ROLE_KEY: str = "your-service-role-key"
    SUPABASE_JWT_SECRET: str = "your-jwt-secret"

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

    # Stripe (billing)
    STRIPE_SECRET_KEY: str = "your-stripe-secret-key"
    STRIPE_WEBHOOK_SECRET: str = "your-stripe-webhook-secret"
    STRIPE_VOYAGER_PRICE_ID: str = "price_voyager"
    STRIPE_NAVIGATOR_PRICE_ID: str = "price_navigator"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
