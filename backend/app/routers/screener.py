"""
Stock Screener — pre-computed fundamentals for a broad market universe.
Covers S&P 500 top components, Dow Jones 30, and Russell 1000 large-caps.
Individual ticker info is cached 24h (via get_ticker_info).
Full screener result cached 2h.
Uses progressive loading: returns cached tickers immediately,
fetches uncached in the background.
"""
import asyncio
import logging
from fastapi import APIRouter, Depends, BackgroundTasks
from app.dependencies import get_current_user
from app.models.db import User
from app.services import market_data
from app.core.cache import cache_get, cache_set

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/screener")

# ── Comprehensive market universe ─────────────────────────────────────────────
# S&P 500 top ~250 + Dow Jones 30 + Russell large-caps + S&P 600 small-cap growth
# Deduplicated, ~400 unique tickers covering mega-cap to small-cap growth

SCREENER_UNIVERSE = sorted(set([
    # ── Dow Jones 30 ──────────────────────────────────────────────────────────
    "AAPL", "AMGN", "AMZN", "AXP", "BA", "CAT", "CRM", "CSCO", "CVX", "DIS",
    "GS", "HD", "HON", "IBM", "INTC", "JNJ", "JPM", "KO", "MCD", "MMM",
    "MRK", "MSFT", "NKE", "NVDA", "PG", "SHW", "TRV", "UNH", "V", "WMT",

    # ── S&P 500 Top Components by Market Cap ──────────────────────────────────
    # Mega-cap tech
    "GOOGL", "GOOG", "META", "TSLA", "AVGO", "ORCL", "ADBE", "AMD", "QCOM",
    "NFLX", "NOW", "INTU", "AMAT", "MU", "LRCX", "KLAC", "SNPS", "CDNS",
    "PANW", "CRWD", "FTNT", "PLTR", "MRVL", "ADI", "TXN", "MCHP", "ON",
    "NXPI", "SWKS", "MPWR", "ENPH",
    # Cloud / Software / Internet
    "UBER", "ABNB", "DASH", "COIN", "SQ", "SHOP", "SNOW", "DDOG", "ZS",
    "NET", "WDAY", "TEAM", "HUBS", "VEEV", "ANSS", "CPAY",
    "TTWO", "EA", "RBLX",
    # Semis & hardware
    "ARM", "SMCI", "DELL",
    # Healthcare / Pharma / Biotech
    "LLY", "UNH", "JNJ", "ABBV", "MRK", "TMO", "PFE", "ABT", "DHR",
    "BMY", "GILD", "VRTX", "REGN", "ISRG", "MDT", "SYK", "BSX", "EW",
    "ZTS", "CI", "HUM", "ELV", "MCK", "COR", "GEHC",
    "IDXX", "IQV", "DXCM", "ALGN", "BIO", "A", "HOLX",
    # Financials
    "JPM", "V", "MA", "BAC", "WFC", "GS", "MS", "BLK", "AXP", "SCHW",
    "C", "USB", "PNC", "TFC", "AIG", "MET", "PRU", "AFL", "ALL",
    "ICE", "CME", "MCO", "MSCI", "SPGI", "FIS", "FISV", "ADP", "PYPL",
    "COF", "DFS",
    # Consumer Discretionary
    "AMZN", "TSLA", "HD", "MCD", "NKE", "SBUX", "TJX", "LOW", "BKNG",
    "CMG", "ORLY", "AZO", "ROST", "DHI", "LEN", "NVR", "PHM",
    "GM", "F", "APTV", "RIVN", "LCID",
    "YUM", "DPZ", "DECK", "LULU", "RCL", "CCL", "MAR", "HLT", "WYNN",
    # Consumer Staples
    "PG", "KO", "PEP", "COST", "WMT", "PM", "MO", "MDLZ", "CL", "KMB",
    "GIS", "HSY", "K", "STZ", "TAP", "EL", "KHC", "SJM", "CAG", "TSN",
    "KR", "SYY", "WBA",
    # Energy
    "XOM", "CVX", "COP", "EOG", "SLB", "MPC", "PSX", "VLO", "OXY",
    "PXD", "HES", "DVN", "FANG", "HAL", "BKR",
    # Industrials
    "CAT", "BA", "HON", "UNP", "UPS", "RTX", "LMT", "GE", "DE",
    "GD", "NOC", "ITW", "EMR", "ETN", "ROK", "PH",
    "CTAS", "FAST", "WM", "RSG", "VRSK", "IR", "FDX", "CARR", "OTIS",
    "CSX", "NSC", "PCAR",
    # Communication Services
    "GOOGL", "META", "DIS", "NFLX", "CMCSA", "T", "VZ", "TMUS", "CHTR",
    "EA", "TTWO", "WBD", "PARA", "FOX",
    # Utilities
    "NEE", "SO", "DUK", "D", "SRE", "AEP", "EXC", "XEL", "WEC", "ED",
    "PCG", "AWK", "ES",
    # REITs
    "PLD", "AMT", "CCI", "EQIX", "PSA", "SPG", "O", "WELL", "DLR",
    "AVB", "EQR", "VTR", "ARE",
    # Materials
    "LIN", "APD", "SHW", "ECL", "DD", "NEM", "FCX", "NUE", "STLD",
    "VMC", "MLM", "DOW",

    # ── S&P 500 remaining components ─────────────────────────────────────────
    "ACGL", "ADM", "AEE", "AES", "AJG", "AKAM", "ALB", "ALLE",
    "AMCR", "AMP", "AME", "ANSS", "AON", "AOS", "APA", "APH",
    "APTV", "ANET", "AXON", "ATO",
    "BALL", "BDX", "BEN", "BF.B", "BIIB", "BK", "BLDR",
    "BR", "BRK.B", "BRO", "BWA",
    "CB", "CBOE", "CDW", "CE", "CF", "CHD", "CHRW", "CINF",
    "CLX", "CNC", "CNP", "CPRT", "CPT", "CRL", "CTLT", "CTRA", "CTSH", "CTVA",
    "DAL", "DAY", "DG", "DGX", "DLTR", "DOV", "DPZ", "DRI", "DVA",
    "EBAY", "EFX", "EIX", "EL", "EMN", "ENPH",
    "EPAM", "EQIX", "EQT", "ESS", "ETSY", "EVRG", "EXR",
    "FANG", "FFIV", "FDS", "FE", "FITB", "FLT", "FMC", "FOX", "FOXA", "FRT",
    "FTNT", "FTV",
    "GEN", "GILD", "GL", "GLW", "GNRC", "GPC", "GPN", "GRMN",
    "HAL", "HAS", "HBAN", "HCA", "HSIC", "HST", "HSY", "HUBB",
    "HWM", "HII",
    "IEX", "ILMN", "INCY", "INVH", "IP", "IPG", "IRM",
    "IT", "IVZ",
    "JBHT", "JCI", "JKHY", "JNPR",
    "KEY", "KDP", "KIM", "KMI", "KVUE",
    "L", "LDOS", "LH", "LKQ", "LNT", "LUV", "LVS", "LW", "LYB", "LYV",
    "MAA", "MAS", "MKTX", "MCHP", "MHK", "MRNA", "MOS",
    "MPW", "MSCI", "MTCH", "MTD", "MTB",
    "NDAQ", "NDSN", "NI", "NRG", "NTAP", "NTRS", "NUE", "NWS",
    "ODFL", "OKE", "OMC", "ORCL",
    "PARA", "PAYC", "PAYX", "PCAR", "PEAK", "PFG", "PKG", "PKI",
    "PODD", "POOL", "PPG", "PPL", "PTC", "PVH",
    "QRVO",
    "RCL", "RE", "REG", "RF", "RJF", "RL", "RMD", "ROL", "ROP",
    "RVTY",
    "SBAC", "SEE", "SNA", "SNPS", "SOLV", "STE", "STT", "STX", "STZ",
    "SWK", "SWKS", "SYF", "SYY",
    "TDG", "TDY", "TECH", "TEL", "TER", "TFX", "TRGP", "TRMB", "TT",
    "TTWO", "TXT", "TYL",
    "UAL", "ULTA", "UDR", "URI",
    "VICI", "VLO", "VMC", "VRSN", "VTRS", "VTR",
    "WAB", "WAT", "WBA", "WBD", "WDC", "WEC", "WELL",
    "WRB", "WRK", "WST", "WTW", "WY",
    "XYL",
    "YUM",
    "ZBRA", "ZBH", "ZION",

    # ── Russell / Growth / Popular additions ──────────────────────────────────
    "MELI", "SE", "GRAB", "NU", "SPOT", "PINS", "SNAP", "ROKU",
    "PATH", "U", "APP", "BILL", "MNDY", "PCOR",
    "TOST", "GLBE",
    "W", "ETSY", "CHWY",
    "CELH", "MNST",
    "TXRH", "WING", "CAVA",
    "DUOL", "BROS",
    "ONON", "BIRK",
    "HOOD", "SOFI", "AFRM",
    "RKLB", "ASTS", "IONQ",
    # More Russell / popular mid-caps
    "DKNG", "PENN", "MGM", "CZR",
    "CROX", "SKX", "TPR", "CPRI",
    "ZM", "DOCU", "OKTA", "TWLO", "DBX", "FVRR", "UPWK",
    "SMMT", "SAIA", "XPO", "ODFL",
    "TW", "LPLA", "IBKR", "MKTX",
    "GNRC", "ENSG", "AMED",
    "TTD", "MGNI", "PUBM",
    "GLOB", "EPAM",
    "FIVE", "OLLI", "BJ",
    "VNET", "RAMP",
    "SFM", "USFD",
    "RNG", "BAND",
    "LITE", "CIEN", "CALX",
    "LSCC", "SLAB",
    "CYTK", "PCVX", "RCKT",
    "AXON", "TDG",
    "TNET", "PAYC",

    # ── S&P 600 / Small-cap growth ─────────────────────────────────────────────
    # Fintech / digital finance
    "UPST", "LC", "OPEN", "PAYO", "RELY", "PSFE", "MQ", "NUVB",
    # E-commerce / consumer
    "RVLV", "XPEL", "PRPL", "DTC", "WRBY", "TASK",
    "FIGS", "HIMS", "CARG", "CARS",
    # SaaS / cloud growth
    "CFLT", "S", "GTLB", "BRZE", "SEMR", "DV", "KVYO",
    "FRSH", "ALKT", "JAMF", "INTA",
    # Cybersecurity / data
    "TENB", "QLYS", "RPD", "VRNS", "CYBR",
    # Biotech / health growth
    "EXAS", "NTRA", "GERN", "ARQT", "INSP",
    "RXRX", "DNA", "CRNX", "IOVA",
    # Clean energy / EV / space
    "PLUG", "FSLR", "RUN", "SEDG", "CHPT", "EVGO",
    "BLNK", "ACHR", "JOBY", "LUNR",
    # Semiconductors (small-cap)
    "RMBS", "ACLS", "CEVA", "POWI", "DIOD", "AMBA", "SITM",
    # AI / robotics / data
    "BBAI", "AI", "BIGC", "PRCT", "NNOX",
    "SOUN", "DM", "GDEV",
    # Food / restaurant growth
    "SHAK", "JACK", "PTLO", "ARKO",
    "EAT", "PLAY", "BJRI",
    # Sports / entertainment / gaming
    "FLUT", "GENI", "RSI", "BETZ",
    # Industrial growth
    "AIRS", "KRNT", "POWL", "TDW", "ACVA",
    # Latin America / emerging market ADRs
    "STNE", "PAGS", "DLO", "VTEX",
]))


# ── Data sanity checks ────────────────────────────────────────────────────────

def _sanitize_row(row: dict) -> dict | None:
    """
    Validate and clean a screener row. Returns None if the stock
    has fundamentally broken data and should be excluded.
    """
    # Must have a name — otherwise it's garbage data
    if not row.get("name"):
        return None

    # P/E sanity: must be positive, cap at 2000 (anything higher is meaningless)
    for key in ("trailing_pe", "forward_pe"):
        val = row.get(key)
        if val is not None and (val <= 0 or val > 2000):
            row[key] = None

    # Market cap must be positive
    if row.get("market_cap") is not None and row["market_cap"] <= 0:
        row["market_cap"] = None

    # Beta sanity: should be between -3 and 10
    if row.get("beta") is not None and (row["beta"] < -3 or row["beta"] > 10):
        row["beta"] = None

    # Dividend yield: 0-20% range (already capped in market_data, but double-check)
    if row.get("dividend_yield") is not None:
        if row["dividend_yield"] < 0 or row["dividend_yield"] > 0.20:
            row["dividend_yield"] = None

    # Margins: should be between -200% and 100%
    for key in ("profit_margins", "gross_margins", "operating_margins"):
        val = row.get(key)
        if val is not None and (val < -2.0 or val > 1.0):
            row[key] = None

    # Price sanity: must be positive
    if row.get("price") is not None and row["price"] <= 0:
        row["price"] = None

    # Day change: cap at ±50% (anything more is likely bad data or stock split)
    if row.get("change_pct") is not None and abs(row["change_pct"]) > 50:
        row["change_pct"] = None

    # 52-week range: high must be >= low
    hi = row.get("fifty_two_week_high")
    lo = row.get("fifty_two_week_low")
    if hi is not None and lo is not None and hi < lo:
        row["fifty_two_week_high"] = None
        row["fifty_two_week_low"] = None

    return row


# ── Background cache warmer ──────────────────────────────────────────────────

_warming = False  # simple lock to avoid double-warming


async def _warm_screener_cache():
    """Fetch info for all tickers that aren't cached yet. Runs in background."""
    global _warming
    if _warming:
        return
    _warming = True
    try:
        batch_size = 15
        fetched = 0
        for i in range(0, len(SCREENER_UNIVERSE), batch_size):
            batch = SCREENER_UNIVERSE[i:i + batch_size]
            tasks = [market_data.get_ticker_info(ticker) for ticker in batch]
            await asyncio.gather(*tasks, return_exceptions=True)
            fetched += len(batch)
            if fetched % 60 == 0:
                logger.info("Screener cache warm: %d / %d", fetched, len(SCREENER_UNIVERSE))
        logger.info("Screener cache warm complete: %d tickers", len(SCREENER_UNIVERSE))

        # Now build and cache the full result
        await _build_and_cache_result()
    finally:
        _warming = False


async def _build_and_cache_result():
    """Build the full screener response from individually cached ticker info."""
    all_results: list[dict] = []

    # Gather all info (should be cached now)
    batch_size = 30
    all_info: dict[str, dict] = {}
    for i in range(0, len(SCREENER_UNIVERSE), batch_size):
        batch = SCREENER_UNIVERSE[i:i + batch_size]
        tasks = [market_data.get_ticker_info(ticker) for ticker in batch]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for ticker, result in zip(batch, results):
            if isinstance(result, Exception) or result is None:
                continue
            all_info[ticker] = result

    # Batch fetch quotes
    tickers_with_info = list(all_info.keys())
    all_quotes: dict[str, dict] = {}
    for i in range(0, len(tickers_with_info), 30):
        batch = tickers_with_info[i:i + 30]
        quotes = await market_data.get_quotes(batch, ttl=60)
        all_quotes.update(quotes)

    # Assemble + sanitize
    for ticker in tickers_with_info:
        info = all_info[ticker]
        quote = all_quotes.get(ticker, {})
        row = {
            "ticker": info.get("ticker", ticker),
            "name": info.get("name"),
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "market_cap": info.get("market_cap"),
            "trailing_pe": info.get("trailing_pe"),
            "forward_pe": info.get("forward_pe"),
            "dividend_yield": info.get("dividend_yield"),
            "beta": info.get("beta"),
            "profit_margins": info.get("profit_margins"),
            "gross_margins": info.get("gross_margins"),
            "operating_margins": info.get("operating_margins"),
            "fifty_two_week_high": info.get("fifty_two_week_high"),
            "fifty_two_week_low": info.get("fifty_two_week_low"),
            "price": quote.get("price"),
            "change_pct": quote.get("change_pct"),
        }
        cleaned = _sanitize_row(row)
        if cleaned is not None:
            all_results.append(cleaned)

    all_results.sort(key=lambda x: x.get("market_cap") or 0, reverse=True)
    await cache_set("screener:universe:v2", all_results, ttl=7200)
    return all_results


# ── Endpoint ─────────────────────────────────────────────────────────────────

@router.get("")
async def get_screener_data(
    background_tasks: BackgroundTasks,
    _: User = Depends(get_current_user),
):
    """
    Returns fundamentals for the screener universe.
    Returns whatever is cached immediately. If not fully cached,
    kicks off background warming and returns partial results.
    """
    # Try full cached result first
    cache_key = "screener:universe:v2"
    cached = await cache_get(cache_key)
    if cached is not None:
        return cached

    # No full cache — collect what we have from individual ticker caches
    partial: list[dict] = []
    uncached_tickers: list[str] = []

    for ticker in SCREENER_UNIVERSE:
        info = await cache_get(f"info:{ticker}")
        if info is not None:
            quote_data = await cache_get(f"quote:{ticker}")
            quote = quote_data if quote_data else {}
            row = {
                "ticker": info.get("ticker", ticker),
                "name": info.get("name"),
                "sector": info.get("sector"),
                "industry": info.get("industry"),
                "market_cap": info.get("market_cap"),
                "trailing_pe": info.get("trailing_pe"),
                "forward_pe": info.get("forward_pe"),
                "dividend_yield": info.get("dividend_yield"),
                "beta": info.get("beta"),
                "profit_margins": info.get("profit_margins"),
                "gross_margins": info.get("gross_margins"),
                "operating_margins": info.get("operating_margins"),
                "fifty_two_week_high": info.get("fifty_two_week_high"),
                "fifty_two_week_low": info.get("fifty_two_week_low"),
                "price": quote.get("price"),
                "change_pct": quote.get("change_pct"),
            }
            cleaned = _sanitize_row(row)
            if cleaned is not None:
                partial.append(cleaned)
        else:
            uncached_tickers.append(ticker)

    # If we have most data, cache the full result
    if len(uncached_tickers) == 0:
        partial.sort(key=lambda x: x.get("market_cap") or 0, reverse=True)
        await cache_set(cache_key, partial, ttl=7200)
        return partial

    # Kick off background warming for uncached tickers
    if uncached_tickers:
        logger.info(
            "Screener: %d cached, %d uncached — starting background warm",
            len(partial), len(uncached_tickers),
        )
        background_tasks.add_task(_warm_screener_cache)

    # Return partial results sorted by market cap
    partial.sort(key=lambda x: x.get("market_cap") or 0, reverse=True)
    return partial
