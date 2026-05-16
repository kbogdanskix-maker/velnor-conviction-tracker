"""
Universal broker import parser.

Supports: XTB, Robinhood, Interactive Brokers (IBKR), Fidelity, Schwab, TD Ameritrade, eToro.
Unknown brokers fall back to a manual column-mapping flow on the frontend.

Design principles:
- Never abort on a single bad row — collect errors and import what we can
- Store raw row in raw_import_data for future re-parsing if schema changes
- Deduplicate on (ticker, executed_at, quantity, price) before inserting
"""
import io
import logging
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Optional

import pandas as pd

logger = logging.getLogger(__name__)

# ── Broker schemas ────────────────────────────────────────────────────────────
# Each schema maps our normalized field names to the broker's column names.
# Multiple aliases are supported — first match wins.

BROKER_SCHEMAS: dict[str, dict] = {
    "xtb": {
        "fingerprint": ["Symbol", "Type", "Time", "Units", "Unit Price"],
        "columns": {
            "ticker": ["Symbol", "symbol", "Instrument"],
            "transaction_type": ["Type", "type", "Operation"],
            "executed_at": ["Time", "time", "Date", "Datetime"],
            "quantity": ["Units", "units", "Quantity", "Volume"],
            "price": ["Unit Price", "unit_price", "Price", "price"],
            "fees": ["Commission", "commission", "Fee", "fee"],
            "currency": ["Currency", "currency"],
        },
        "type_map": {
            "Buy": "buy", "Sell": "sell",
            "Open": "buy", "Close": "sell",
            "Dividend": "dividend",
        },
        "decimal_separator": ",",  # XTB European locale
    },
    "robinhood": {
        "fingerprint": ["Activity Date", "Process Date", "Settle Date", "Instrument"],
        "columns": {
            "ticker": ["Instrument", "Symbol"],
            "transaction_type": ["Trans. Code", "Trans Code", "Type"],
            "executed_at": ["Activity Date", "Process Date"],
            "quantity": ["Quantity"],
            "price": ["Price"],
            "fees": [],  # Robinhood doesn't charge commissions
            "currency": [],  # Always USD
        },
        "type_map": {
            "Buy": "buy", "Sell": "sell", "BTO": "buy", "STC": "sell",
            "CDIV": "dividend", "DIV": "dividend",
        },
        "decimal_separator": ".",
    },
    "ibkr": {
        "fingerprint": ["Symbol", "Date/Time", "Quantity", "T. Price", "C. Price"],
        "columns": {
            "ticker": ["Symbol"],
            "transaction_type": ["Buy/Sell"],
            "executed_at": ["Date/Time"],
            "quantity": ["Quantity"],
            "price": ["T. Price"],
            "fees": ["Comm/Fee", "Commission"],
            "currency": ["Currency"],
        },
        "type_map": {
            "BUY": "buy", "BOT": "buy",
            "SELL": "sell", "SLD": "sell",
        },
        "decimal_separator": ".",
    },
    "fidelity": {
        "fingerprint": ["Run Date", "Account", "Action", "Symbol", "Security Description"],
        "columns": {
            "ticker": ["Symbol"],
            "transaction_type": ["Action"],
            "executed_at": ["Run Date", "Settlement Date"],
            "quantity": ["Quantity"],
            "price": ["Price ($)"],
            "fees": ["Commission ($)", "Fees ($)"],
            "currency": [],
        },
        "type_map": {
            "YOU BOUGHT": "buy", "YOU SOLD": "sell",
            "REINVESTMENT": "buy", "DIVIDEND RECEIVED": "dividend",
        },
        "decimal_separator": ".",
    },
    "schwab": {
        "fingerprint": ["Date", "Action", "Symbol", "Description", "Quantity", "Price", "Fees & Comm"],
        "columns": {
            "ticker": ["Symbol"],
            "transaction_type": ["Action"],
            "executed_at": ["Date"],
            "quantity": ["Quantity"],
            "price": ["Price"],
            "fees": ["Fees & Comm"],
            "currency": [],
        },
        "type_map": {
            "Buy": "buy", "Sell": "sell",
            "Reinvest Dividend": "dividend", "Cash Dividend": "dividend",
        },
        "decimal_separator": ".",
    },
    "etoro": {
        "fingerprint": ["Date", "Type", "Details", "Amount", "Units", "Realized Equity Change"],
        "columns": {
            "ticker": ["Details"],
            "transaction_type": ["Type"],
            "executed_at": ["Date"],
            "quantity": ["Units"],
            "price": ["Open Rate", "Close Rate"],
            "fees": ["Spread Fee", "Fee"],
            "currency": [],
        },
        "type_map": {
            "Open Position": "buy", "Close Position": "sell",
            "Dividend": "dividend",
        },
        "decimal_separator": ".",
    },
}

# Transaction types to skip (non-trade rows)
SKIP_TYPES = {
    "deposit", "withdrawal", "transfer", "interest", "fee",
    "swap", "conversion", "funding", "adjustment",
}


# ── Public API ────────────────────────────────────────────────────────────────

def detect_broker(df: pd.DataFrame) -> Optional[str]:
    """
    Identify broker from column fingerprint.
    Returns broker key (e.g. 'xtb') or None if unknown.
    """
    columns_lower = {c.lower().strip() for c in df.columns}
    for broker, schema in BROKER_SCHEMAS.items():
        required = {c.lower() for c in schema["fingerprint"]}
        if required.issubset(columns_lower):
            return broker
    return None


def parse_broker_file(
    file_bytes: bytes,
    filename: str,
    broker_override: Optional[str] = None,
    column_mapping: Optional[dict[str, str]] = None,
) -> dict:
    """
    Parse a broker export file into normalized transaction dicts.

    Args:
        file_bytes: raw file content
        filename: used to detect .csv vs .xlsx
        broker_override: if provided, skip auto-detection and use this broker schema
        column_mapping: for unknown brokers — maps field_name → column_name in file

    Returns:
        {
            "broker": "xtb" | "robinhood" | ... | "unknown",
            "transactions": [...],
            "skipped": [...],
            "errors": [...],
        }
    """
    # Load into DataFrame
    try:
        ext = filename.rsplit(".", 1)[-1].lower()
        if ext in ("xlsx", "xls"):
            df = pd.read_excel(io.BytesIO(file_bytes), dtype=str)
        else:
            # Try multiple encodings
            for encoding in ("utf-8", "latin-1", "cp1252"):
                try:
                    df = pd.read_csv(io.BytesIO(file_bytes), dtype=str, encoding=encoding)
                    break
                except UnicodeDecodeError:
                    continue
            else:
                return {"broker": "unknown", "transactions": [], "skipped": [], "errors": ["Could not decode file"]}
    except Exception as e:
        return {"broker": "unknown", "transactions": [], "skipped": [], "errors": [str(e)]}

    # Strip whitespace from all string columns
    df.columns = [str(c).strip() for c in df.columns]
    df = df.apply(lambda col: col.str.strip() if col.dtype == "object" else col)

    # Detect broker
    broker = broker_override or detect_broker(df)

    if broker and broker in BROKER_SCHEMAS:
        schema = BROKER_SCHEMAS[broker]
    elif column_mapping:
        broker = "custom"
        schema = _build_schema_from_mapping(column_mapping)
    else:
        return {
            "broker": "unknown",
            "transactions": [],
            "skipped": [],
            "errors": [],
            "needs_mapping": True,
            "columns": list(df.columns),
            "preview": df.head(10).to_dict(orient="records"),
        }

    decimal_sep = schema.get("decimal_separator", ".")
    type_map = schema.get("type_map", {})
    col_map = schema["columns"]

    transactions = []
    skipped = []
    errors = []

    for idx, row in df.iterrows():
        try:
            tx = _parse_row(row, col_map, type_map, decimal_sep, broker)
            if tx is None:
                skipped.append({"row": idx, "reason": "non-trade row or empty ticker"})
                continue
            transactions.append(tx)
        except Exception as e:
            errors.append({"row": idx, "error": str(e), "data": row.to_dict()})

    return {
        "broker": broker,
        "transactions": transactions,
        "skipped": skipped,
        "errors": errors,
    }


# ── Row parsing ───────────────────────────────────────────────────────────────

def _parse_row(
    row: pd.Series,
    col_map: dict,
    type_map: dict,
    decimal_sep: str,
    broker: str,
) -> Optional[dict]:
    """Parse a single DataFrame row into a normalized transaction dict."""

    # Resolve ticker
    ticker = _resolve_column(row, col_map.get("ticker", []))
    if not ticker or pd.isna(ticker):
        return None
    ticker = str(ticker).upper().strip()

    # Resolve transaction type
    raw_type = _resolve_column(row, col_map.get("transaction_type", []))
    if raw_type:
        raw_type = str(raw_type).strip()
    tx_type = _map_type(raw_type, type_map)

    if tx_type is None or tx_type in SKIP_TYPES:
        return None

    # Resolve numeric fields
    quantity = _parse_decimal(row, col_map.get("quantity", []), decimal_sep)
    price = _parse_decimal(row, col_map.get("price", []), decimal_sep)
    fees = _parse_decimal(row, col_map.get("fees", []), decimal_sep, default=Decimal("0"))
    currency = _resolve_column(row, col_map.get("currency", [])) or "USD"

    if quantity is None or price is None:
        raise ValueError(f"Missing quantity or price for ticker {ticker}")

    # Resolve datetime
    executed_at = _parse_datetime(row, col_map.get("executed_at", []))
    if executed_at is None:
        raise ValueError(f"Could not parse date for ticker {ticker}")

    return {
        "ticker": ticker,
        "asset_type": "stock",
        "transaction_type": tx_type,
        "quantity": abs(float(quantity)),
        "price": abs(float(price)),
        "fees": abs(float(fees)),
        "currency": str(currency).upper()[:3] if currency else "USD",
        "fx_rate": 1.0,
        "executed_at": executed_at.isoformat(),
        "source": "import",
        "broker": broker,
        "raw_data": row.to_dict(),
    }


# ── Helpers ───────────────────────────────────────────────────────────────────

def _resolve_column(row: pd.Series, aliases: list[str]) -> Optional[str]:
    """Find the first matching column alias in the row."""
    for alias in aliases:
        if alias in row.index and not pd.isna(row[alias]):
            return str(row[alias])
    # Case-insensitive fallback
    for alias in aliases:
        for col in row.index:
            if col.lower() == alias.lower() and not pd.isna(row[col]):
                return str(row[col])
    return None


def _parse_decimal(
    row: pd.Series,
    aliases: list[str],
    decimal_sep: str = ".",
    default: Optional[Decimal] = None,
) -> Optional[Decimal]:
    """Parse a numeric column, handling European decimals and currency symbols."""
    raw = _resolve_column(row, aliases)
    if raw is None:
        return default
    # Remove currency symbols, spaces, thousands separators
    cleaned = str(raw).replace("$", "").replace("€", "").replace("£", "").replace(" ", "").strip()
    if decimal_sep == ",":
        # European format: 1.234,56 → 1234.56
        cleaned = cleaned.replace(".", "").replace(",", ".")
    else:
        cleaned = cleaned.replace(",", "")
    cleaned = cleaned.lstrip("-+") if cleaned.startswith(("-", "+")) else cleaned
    try:
        return Decimal(cleaned) if cleaned else default
    except InvalidOperation:
        return default


def _parse_datetime(row: pd.Series, aliases: list[str]) -> Optional[datetime]:
    """Parse a datetime column, trying multiple formats."""
    raw = _resolve_column(row, aliases)
    if not raw:
        return None
    formats = [
        "%Y-%m-%d %H:%M:%S", "%Y-%m-%d",
        "%m/%d/%Y", "%d/%m/%Y",
        "%Y-%m-%dT%H:%M:%S", "%d-%m-%Y",
        "%m/%d/%Y %H:%M",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(str(raw).strip(), fmt)
        except ValueError:
            continue
    # Pandas fallback
    try:
        return pd.to_datetime(raw).to_pydatetime()
    except Exception:
        return None


def _map_type(raw: Optional[str], type_map: dict) -> Optional[str]:
    if not raw:
        return None
    # Exact match first
    if raw in type_map:
        return type_map[raw]
    # Case-insensitive
    for key, val in type_map.items():
        if key.lower() == raw.lower():
            return val
    return None


def _build_schema_from_mapping(column_mapping: dict[str, str]) -> dict:
    """Build a schema dict from a user-provided column mapping (unknown brokers)."""
    return {
        "columns": {field: [col] for field, col in column_mapping.items()},
        "type_map": {
            "buy": "buy", "Buy": "buy", "BUY": "buy",
            "sell": "sell", "Sell": "sell", "SELL": "sell",
            "dividend": "dividend", "Dividend": "dividend",
        },
        "decimal_separator": ".",
    }
