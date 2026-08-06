import yfinance as yf
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split
from datetime import datetime
import requests # Import requests for session management
import threading
import time
import os

ALPHA_KEY = os.getenv("ALPHA_KEY")
FINNHUB_KEY = os.getenv("FINNHUB_KEY")



FEATURES = ["Lag1", "Lag2", "Lag3", "Lag5", "Lag10", "SMA_5", "SMA_10", "RSI_14"]
MIN_ROWS_FOR_FEATURES = 30  # need enough history to build lag10/sma10/rsi14 and leave rows for training

# In-memory cache for raw historical fetches, keyed by ticker, to avoid
# re-downloading the same full price history on every request within a short window.
_FETCH_CACHE: dict[str, tuple[float, pd.DataFrame, int | None]] = {}
_FETCH_CACHE_TTL_SECONDS = 300
_FETCH_CACHE_LOCK = threading.Lock()

def _fetch(ticker: str) -> tuple[pd.DataFrame, float | None]:
    now = time.time()
    with _FETCH_CACHE_LOCK:
        cached = _FETCH_CACHE.get(ticker)
        if cached and (now - cached[0]) < _FETCH_CACHE_TTL_SECONDS:
            return cached[1].copy(), cached[2]

    today = datetime.today().strftime("%Y-%m-%d")
    stock = yf.Ticker(ticker)
    df = stock.history(start="2015-01-01", end=today, auto_adjust=True)

    market_cap = None

    # Try Alpha Vantage first
    try:
        url_alpha = f"https://www.alphavantage.co/query?function=OVERVIEW&symbol={ticker}&apikey={ALPHA_KEY}"
        data_alpha = requests.get(url_alpha).json()
        mc = data_alpha.get("MarketCapitalization")
        if mc:
            market_cap = float(mc)
            print(f"{ticker} market cap from Alpha Vantage: {market_cap}")
    except Exception as e:
        print(f"Alpha Vantage error for {ticker}: {e}")

    # Fallback to Finnhub if Alpha Vantage fails
    if market_cap is None:
        try:
            url_finnhub = f"https://finnhub.io/api/v1/stock/metric?symbol={ticker}&metric=all&token={FINNHUB_KEY}"
            data_finnhub = requests.get(url_finnhub).json()
            mc = data_finnhub.get("metric", {}).get("marketCapitalization")
            if mc:
                market_cap = float(mc)
                print(f"{ticker} market cap from Finnhub: {market_cap}")
        except Exception as e:
            print(f"Finnhub error for {ticker}: {e}")

    if df.empty:
        df = yf.download(ticker, start="2015-01-01", end=today, auto_adjust=True)

    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    with _FETCH_CACHE_LOCK:
        _FETCH_CACHE[ticker] = (now, df, market_cap)

    print(f"DEBUG: {ticker} market_cap = {market_cap}")
    return df, market_cap

def _build_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["Lag1"] = df["Close"].shift(1)
    df["Lag2"] = df["Close"].shift(2)
    df["Lag3"] = df["Close"].shift(3)
    df["Lag5"] = df["Close"].shift(5)
    df["Lag10"] = df["Close"].shift(10)
    df["SMA_5"] = df["Close"].rolling(window=5).mean()
    df["SMA_10"] = df["Close"].rolling(window=10).mean()
    delta = df["Close"].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss
    df["RSI_14"] = 100 - (100 / (1 + rs))
    df.dropna(inplace=True)
    return df


def _train(df: pd.DataFrame):
    X = df[FEATURES]
    y = df["Close"]
    X_train, _, y_train, _ = train_test_split(X, y, test_size=0.2, shuffle=False)
    model = LinearRegression()
    model.fit(X_train, y_train)
    residuals = y_train.values - model.predict(X_train)
    std_dev = float(np.std(residuals))
    return model, std_dev


def _dynamic_forecast(model, df: pd.DataFrame, std_dev: float, n: int = 7) -> list:
    # Seed rolling window with last 28 prices (enough for lag10, sma10, rsi14)
    latest_prices = df["Close"].iloc[-28:].squeeze().tolist()
    last_date = df.index[-1]
    future_dates = pd.bdate_range(start=last_date + pd.Timedelta(days=1), periods=n)

    results = []
    for i in range(n):
        sma5 = float(np.mean(latest_prices[-5:]))
        sma10 = float(np.mean(latest_prices[-10:]))

        deltas = np.diff(latest_prices[-15:])
        gains = float(np.where(deltas > 0, deltas, 0).mean())
        losses = float(np.where(deltas < 0, -deltas, 0).mean())
        if losses == 0 and gains == 0:
            rsi14 = 50.0
        elif losses == 0:
            rsi14 = 100.0
        else:
            rs = gains / losses
            rsi14 = 100.0 - (100.0 / (1.0 + rs))

        lag1 = latest_prices[-1]
        lag2 = latest_prices[-2]
        lag3 = latest_prices[-3]
        lag5 = latest_prices[-5]
        lag10 = latest_prices[-10]

        features = pd.DataFrame([[lag1, lag2, lag3, lag5, lag10, sma5, sma10, rsi14]], columns=FEATURES)
        value = float(model.predict(features)[0])

        results.append({
            "date": future_dates[i].strftime("%Y-%m-%d"),
            "value": round(value, 2),
            "lower": round(value - std_dev, 2),
            "upper": round(value + std_dev, 2),
        })
        latest_prices.append(value)

    return results


def run_forecast(ticker: str, start_date: str | None = None) -> dict:
    df_full, market_cap = _fetch(ticker)
    if df_full.empty or df_full["Close"].dropna().empty:
        raise ValueError(f"Forecast unavailable for ticker '{ticker}' due to insufficient data.")

    df_feat = _build_features(df_full)
    if len(df_feat) < MIN_ROWS_FOR_FEATURES:
        raise ValueError(f"Forecast unavailable for ticker '{ticker}' due to insufficient data.")

    model, std_dev = _train(df_feat)
    if np.isnan(std_dev) or np.isinf(std_dev):
        raise ValueError(f"Forecast unavailable for ticker '{ticker}' due to insufficient data.")

    forecast = _dynamic_forecast(model, df_feat, std_dev)
    if any(
        np.isnan(row["value"]) or np.isinf(row["value"])
        or np.isnan(row["lower"]) or np.isinf(row["lower"])
        or np.isnan(row["upper"]) or np.isinf(row["upper"])
        for row in forecast
    ):
        raise ValueError(f"Forecast unavailable for ticker '{ticker}' due to insufficient data.")

    # History window: from start_date if given, else last 90 calendar days
    if start_date:
        history_df = df_full[df_full.index >= start_date]
    else:
        history_df = df_full.iloc[-90:]

    history = [
        {"date": idx.strftime("%Y-%m-%d"), "close": round(float(close), 2)}
        for idx, close in zip(history_df.index, history_df["Close"])
        if not np.isnan(close)
    ]

    pct = history_df["Close"].pct_change() * 100
    daily_changes = [
        {"date": idx.strftime("%Y-%m-%d"), "change": round(float(c), 2)}
        for idx, c in zip(pct.index[1:], pct.iloc[1:])
        if not np.isnan(c)
    ]

    return {
        "ticker": ticker.upper(),
        "history": history,
        "forecast": forecast,
        "daily_changes": daily_changes,
        "market_cap": market_cap,
    }