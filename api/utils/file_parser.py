"""
Parse user-uploaded market data files into a price matrix (dates × tickers).
Supports CSV (wide/long), Excel, and JSON formats.
"""
import io
import pandas as pd
import numpy as np
from pathlib import Path


class FileParseError(ValueError):
    """User-readable parse/validation error."""
    pass


def parse_user_file(path: str) -> pd.DataFrame:
    """
    Parse an uploaded file into a price DataFrame (rows=dates, cols=tickers).

    Accepts:
      - CSV wide:  Date, AAPL, MSFT, ...
      - CSV long:  Date, Symbol, Adj Close   (or Close)
      - Excel .xlsx/.xls  (same shapes, first sheet)
      - JSON records: [{"Date": "...", "AAPL": 296.24}]
               or nested:  {"AAPL": {"2020-01-02": 296.24}}

    Returns:
      pd.DataFrame with DatetimeIndex, float columns (tickers), sorted ascending.

    Raises:
      FileParseError with a human-readable message on any validation problem.
    """
    p = Path(path)
    suffix = p.suffix.lower()

    # ── Load raw DataFrame ──────────────────────────────────────────────────
    try:
        if suffix in (".xlsx", ".xls"):
            raw = _read_excel_smart(path)
        elif suffix == ".json":
            raw = _load_json(path)
        else:  # .csv or anything else treated as CSV
            raw = _read_csv_smart(path)
    except FileParseError:
        raise
    except Exception as exc:
        raise FileParseError(f"Could not read file: {exc}") from exc

    # ── Normalise column names ──────────────────────────────────────────────
    raw.columns = [str(c).strip() for c in raw.columns]

    # ── Detect date column ──────────────────────────────────────────────────
    date_col = _find_date_column(raw)
    if date_col is None:
        raise FileParseError(
            "No date column found. Please include a column named 'Date', "
            "'date', 'Datetime', or 'timestamp'."
        )

    # ── Parse dates in-place BEFORE pivot/reshape ────────────────────────────
    # Doing this on the Series (not the Index) is more reliable because pandas
    # has full dtype context and we can report a sample of bad values.
    raw[date_col] = _parse_date_series(raw[date_col])

    # ── Detect wide vs long format ──────────────────────────────────────────
    symbol_col = _find_symbol_column(raw)
    if symbol_col is not None:
        df = _pivot_long(raw, date_col, symbol_col)
    else:
        df = _reshape_wide(raw, date_col)

    # ── Ensure DatetimeIndex (pivot preserves Timestamps, but make sure) ─────
    if not isinstance(df.index, pd.DatetimeIndex):
        df.index = pd.to_datetime(df.index, errors="coerce")

    df = df.sort_index()
    # Drop rows where date couldn't be parsed
    df = df[df.index.notna()]

    # Coerce all columns to float (handles any remaining string prices)
    for col in df.columns:
        df[col] = _coerce_to_numeric(df[col])

    # ── Validation ──────────────────────────────────────────────────────────
    _validate(df)

    return df


# ────────────────────────────────────────────────────────────────────────────
# Private helpers
# ────────────────────────────────────────────────────────────────────────────

def _find_date_column(df: pd.DataFrame):
    candidates = ["date", "datetime", "timestamp", "time", "index"]
    for col in df.columns:
        if col.lower() in candidates:
            return col
    return None


def _find_symbol_column(df: pd.DataFrame):
    candidates = ["symbol", "ticker", "stock", "name"]
    for col in df.columns:
        if col.lower() in candidates:
            return col
    return None


def _find_price_column(df: pd.DataFrame):
    candidates = ["adj close", "adjclose", "adj_close", "close", "price", "value"]
    for col in df.columns:
        if col.lower().replace(" ", "_") in [c.replace(" ", "_") for c in candidates]:
            return col
    return None


def _read_excel_smart(path: str) -> pd.DataFrame:
    """
    Read Excel, automatically skipping title/metadata rows above the real headers.
    Tries header=0, 1, 2 until a date column is found.
    """
    for header_row in range(3):
        df = pd.read_excel(path, sheet_name=0, header=header_row)
        df.columns = [str(c).strip() for c in df.columns]
        if _find_date_column(df) is not None:
            return df
    # Fall back to default if nothing found (will raise "No date column" later)
    return pd.read_excel(path, sheet_name=0)


def _read_csv_smart(path: str) -> pd.DataFrame:
    """
    Read CSV, automatically skipping title/metadata rows above the real headers.
    Also handles common encodings and separators.
    """
    for encoding in ("utf-8", "utf-8-sig", "latin-1", "cp1252"):
        for sep in (",", ";", "\t", "|"):
            try:
                # Try default header first
                df = pd.read_csv(path, sep=sep, encoding=encoding, engine="python")
                df.columns = [str(c).strip() for c in df.columns]
                if _find_date_column(df) is not None:
                    return df
                # Try skipping 1 or 2 title rows
                for skip in (1, 2):
                    df2 = pd.read_csv(path, sep=sep, encoding=encoding,
                                      skiprows=skip, engine="python")
                    df2.columns = [str(c).strip() for c in df2.columns]
                    if _find_date_column(df2) is not None:
                        return df2
            except Exception:
                continue
    # Final fallback — let pandas decide, error will surface later
    return pd.read_csv(path)


def _coerce_to_numeric(series: pd.Series) -> pd.Series:
    """
    Convert a series to float, handling common non-numeric formats:
      - Currency symbols: $, £, €, ¥, ₹
      - Thousands comma separators: 1,234.56
      - Parenthetical negatives: (1234) → -1234
      - Trailing % signs (converted to decimal): 12.5% → 12.5
      - Whitespace
    Returns a float series; non-parseable values become NaN.
    """
    # Already numeric — return as-is
    if pd.api.types.is_numeric_dtype(series):
        return series.astype(float)

    s = series.astype(str).str.strip()

    # Parenthetical negatives: (1234.56) → -1234.56
    paren_mask = s.str.match(r"^\(.*\)$")
    s = s.where(~paren_mask, "-" + s.str.strip("()"))

    # Strip currency symbols and thousands commas
    s = s.str.replace(r"[$£€¥₹,]", "", regex=True).str.strip()

    # Strip trailing % (keep value as-is, not divided by 100)
    s = s.str.rstrip("%").str.strip()

    return pd.to_numeric(s, errors="coerce")


def _pivot_long(df: pd.DataFrame, date_col: str, symbol_col: str) -> pd.DataFrame:
    """Pivot long-format (date, symbol, price) → wide (date × tickers)."""
    price_col = _find_price_column(df)
    if price_col is None:
        # Try any column that coerces to numeric (excluding date/symbol cols)
        skip = {date_col.lower(), symbol_col.lower()}
        for col in df.columns:
            if col.lower() in skip:
                continue
            s = _coerce_to_numeric(df[col])
            if s.notna().any():
                price_col = col
                df = df.copy()
                df[col] = s
                break
        if price_col is None:
            raise FileParseError(
                "Long-format file must have a price column (e.g. 'Adj Close', 'Close', 'price')."
            )

    try:
        wide = df.pivot(index=date_col, columns=symbol_col, values=price_col)
    except ValueError:
        # Duplicate (date, symbol) pairs — aggregate by taking the daily close
        # (last value per day, which is the end-of-day price for intraday data)
        wide = df.pivot_table(
            index=date_col, columns=symbol_col, values=price_col, aggfunc="last"
        )
    except Exception as exc:
        raise FileParseError(f"Could not pivot long-format data: {exc}") from exc

    wide.index.name = "Date"
    wide.columns.name = None
    return wide


def _reshape_wide(df: pd.DataFrame, date_col: str) -> pd.DataFrame:
    """Set date as index, coerce remaining columns to numeric."""
    df = df.set_index(date_col)
    df.index.name = "Date"

    coerced = {}
    for col in df.columns:
        s = _coerce_to_numeric(df[col])
        if s.notna().any():
            coerced[col] = s

    if not coerced:
        raise FileParseError(
            "No numeric price columns found. "
            "Columns may contain currency symbols (e.g. $1,234.56) — "
            "these are handled automatically, but please check the file has price data."
        )
    return pd.DataFrame(coerced, index=df.index)


def _load_json(path: str) -> pd.DataFrame:
    """Load JSON in records or nested-dict form."""
    import json
    with open(path) as f:
        data = json.load(f)

    if isinstance(data, list):
        # records: [{"Date": "...", "AAPL": 296.24}]
        return pd.DataFrame(data)
    elif isinstance(data, dict):
        # nested: {"AAPL": {"2020-01-02": 296.24}}
        return pd.DataFrame(data)
    else:
        raise FileParseError("JSON must be a list of records or a nested dict.")


def _parse_date_series(series: pd.Series) -> pd.Series:
    """
    Parse a Series of date values into datetime64, trying every reasonable
    strategy. Works on the Series (not Index) so dtype context is available.
    Returns a datetime Series; unparseable rows become NaT.
    """
    MIN_VALID_FRAC = 0.5

    def _enough(s: pd.Series) -> bool:
        valid = s.notna().sum()
        return valid > 0 and valid / max(len(s), 1) >= MIN_VALID_FRAC

    # Already datetime — nothing to do
    if pd.api.types.is_datetime64_any_dtype(series):
        return series

    # Strategy 1: let pandas infer (handles Timestamps, ISO strings, Excel serials)
    try:
        result = pd.to_datetime(series, errors="coerce")
        if _enough(result):
            return result
    except Exception:
        pass

    # Strategy 2: coerce string representations
    s_str = series.astype(str).str.strip()

    # Strategy 3: explicit formats, ISO first
    formats = [
        "%Y-%m-%d", "%Y/%m/%d",
        "%Y%m%d",
        "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S",
        "%m/%d/%Y", "%m/%d/%y",
        "%d/%m/%Y", "%d/%m/%y",
        "%d-%m-%Y", "%d-%m-%y",
        "%m-%d-%Y", "%m-%d-%y",
        "%b %d, %Y", "%B %d, %Y",
        "%d %b %Y", "%d %B %Y",
        "%Y/%m/%d %H:%M:%S",
        "%m/%d/%Y %H:%M:%S",
    ]
    for fmt in formats:
        try:
            result = pd.to_datetime(s_str, format=fmt, errors="coerce")
            if _enough(result):
                return result
        except Exception:
            pass

    # Strategy 4: element-wise dateutil — most permissive, handles anything
    try:
        from dateutil import parser as du_parser
        parsed = []
        for val in series:
            try:
                parsed.append(pd.Timestamp(du_parser.parse(str(val))))
            except Exception:
                parsed.append(pd.NaT)
        result = pd.Series(parsed, index=series.index, dtype="datetime64[ns]")
        if _enough(result):
            return result
    except Exception:
        pass

    # Build a helpful error showing sample values
    samples = series.dropna().astype(str).head(3).tolist()
    raise FileParseError(
        f"Could not parse dates. Sample values from your date column: {samples}. "
        "Expected formats like YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, etc."
    )


def _validate(df: pd.DataFrame):
    """Run validation checks and raise FileParseError with user-friendly messages."""
    n_rows, n_cols = df.shape

    if n_cols == 0:
        raise FileParseError("No price columns found after parsing.")

    if n_rows < 63:
        raise FileParseError(
            f"Dataset has only {n_rows} trading days. "
            "At least 63 trading days are required for regime analysis."
        )

    # Drop tickers that are individually too sparse (>80% missing for that ticker).
    # Multi-ticker datasets spanning long periods are naturally sparse per-column
    # because stocks enter/exit the market at different times.
    col_missing = df.isna().mean()
    good_cols = col_missing[col_missing <= 0.80].index.tolist()
    if not good_cols:
        raise FileParseError(
            "Every ticker has more than 80% missing values. "
            "Please check that the file contains valid price data."
        )
    dropped = n_cols - len(good_cols)
    if dropped > 0:
        print(f"[file_parser] Dropped {dropped} tickers with >80% missing values; "
              f"{len(good_cols)} tickers retained.")
    df.drop(columns=[c for c in df.columns if c not in good_cols], inplace=True)

    # Negative price check
    neg_mask = (df < 0) & df.notna()
    if neg_mask.any().any():
        neg_cols = df.columns[neg_mask.any()].tolist()
        raise FileParseError(
            f"Negative prices found in columns: {', '.join(neg_cols[:5])}. "
            "Prices must be positive."
        )

    # Fill forward then drop any remaining NaN
    df.ffill(inplace=True)
    df.dropna(how="all", inplace=True)
