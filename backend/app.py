#app.py (updated version)
#app.py (updated version)
from flask import Flask, request, jsonify
from flask_cors import CORS
from .forecaster import run_forecast
import yfinance as yf
import traceback # Import traceback module
from concurrent.futures import ThreadPoolExecutor

app = Flask(__name__)
CORS(app, origins=["http://localhost:5173", "https://marketpulse-frontend-2ovy.onrender.com"])

# Dynamic mapping of company names to tickers for better user experience
COMMON_MAP = {
    "apple": "AAPL",
    "microsoft": "MSFT",
    "google": "GOOGL",
    "alphabet": "GOOGL",
    "amazon": "AMZN",
    "nvidia": "NVDA",
    "meta": "META",
    "facebook": "META",
    "tesla": "TSLA",
    "netflix": "NFLX",
    "adobe": "ADBE",
    "salesforce": "CRM",
    "intel": "INTC",
    "amd": "AMD",
    "paypal": "PYPL",
    "uber": "UBER",
    "airbnb": "ABNB",
    "spotify": "SPOT",
    "twitter": "X",
    "snap": "SNAP",
}

def resolve_ticker(name: str) -> str:
    name_clean = name.lower().strip()
    if name_clean in COMMON_MAP:
        return COMMON_MAP[name_clean]

    # Try direct ticker
    try:
        ticker = yf.Ticker(name.upper().strip())
        info = ticker.info
        if "symbol" in info:
            return info["symbol"]
    except Exception:
        pass

    # Fallback search
    try:
        search_obj = yf.Search(name)
        if search_obj.quotes:
            return search_obj.quotes[0]["symbol"]
    except Exception:
        pass

    raise ValueError(f"Could not resolve ticker for '{name}'")


def _resolve_and_forecast(name: str, start_date: str | None) -> dict:
    ticker = resolve_ticker(name)
    return run_forecast(ticker, start_date=start_date)


@app.route("/api/forecast", methods=["POST"])
def forecast():
    body = request.get_json(force=True, silent=True) or {}
    tickers_raw = body.get("tickers", [])
    start_date = body.get("start_date") or None

    if not tickers_raw:
        return jsonify({"error": "tickers field is required and must be a non-empty list"}), 400

    stocks = []

    # Tickers are independent I/O-bound fetches (yfinance network calls); run them
    # concurrently so a multi-stock portfolio doesn't wait on each stock sequentially.
    with ThreadPoolExecutor(max_workers=min(8, len(tickers_raw))) as executor:
        futures = [executor.submit(_resolve_and_forecast, name, start_date) for name in tickers_raw]
        for name, future in zip(tickers_raw, futures):
            try:
                stocks.append(future.result())
            except ValueError as e:
                print(f"Forecast validation error for '{name}': {e}")
                return jsonify({"error": str(e)}), 404
            except Exception:
                print(f"An error occurred during forecast for '{name}':")
                traceback.print_exc() # Log full traceback server-side only, never expose to the client
                return jsonify({"error": f"Forecast unavailable for ticker '{name}' due to insufficient data."}), 500

    tickers = [s["ticker"] for s in stocks]

    n = len(tickers)
    equal_weights = {t: round(1 / n, 4) for t in tickers}

    total_mc = sum(s.get("market_cap") or 0 for s in stocks)
    if total_mc > 0:
        raw_mc = {s["ticker"]: (s.get("market_cap") or 0) / total_mc for s in stocks}
        # Assign proportional weights, last ticker absorbs rounding remainder
        mc_weights = {}
        allocated = 0.0
        for i, t in enumerate(tickers):
            if i == n - 1:
                mc_weights[t] = round(1.0 - allocated, 4)
            else:
                w = round(raw_mc[t], 4)
                mc_weights[t] = w
                allocated += w
    else:
        mc_weights = equal_weights.copy()

    weights = {"equal": equal_weights, "marketcap": mc_weights}

    # Consolidated portfolio: equal-weight average across all stocks (only for >= 2 tickers)
    portfolio = None
    if n >= 2:
        # History: inner-join on dates present in ALL stocks, then average close price
        from collections import defaultdict
        history_map = defaultdict(list)
        for stock in stocks:
            for row in stock["history"]:
                history_map[row["date"]].append(row["close"])
        portfolio_history = [
            {"date": d, "close": round(sum(closes) / n, 2)}
            for d, closes in sorted(history_map.items())
            if len(closes) == n
        ]

        # Forecast: average value/lower/upper per day (all stocks share same business-day dates)
        portfolio_forecast = []
        for i in range(7):
            portfolio_forecast.append({
                "date": stocks[0]["forecast"][i]["date"],
                "value": round(sum(s["forecast"][i]["value"] for s in stocks) / n, 2),
                "lower": round(sum(s["forecast"][i]["lower"] for s in stocks) / n, 2),
                "upper": round(sum(s["forecast"][i]["upper"] for s in stocks) / n, 2),
            })

        portfolio = {"history": portfolio_history, "forecast": portfolio_forecast}
    
     # 👉 Decide which weights to return BEFORE returning
    weight_type = body.get("weight", "equal")
    chosen_weights = weights.get(weight_type, equal_weights)

    return jsonify({
        "stocks": stocks,
        "weights": chosen_weights,
        "portfolio": portfolio
    })  
    # return jsonify({"stocks": stocks, "weights": weights, "portfolio": portfolio})

 
@app.route("/api/search", methods=["GET"])
def search_ticker():
    query = request.args.get("q", "")
    if not query:
        return jsonify([])
    try:
        search_obj = yf.Search(query)
        results = []
        for quote in search_obj.quotes:
            results.append({
                "symbol": quote.get("symbol"),
                "shortname": quote.get("shortname") or quote.get("longname") or quote.get("symbol"),
                "exchange": quote.get("exchange"),
                "quoteType": quote.get("quoteType")
            })
        return jsonify(results)
    except Exception:
        print(f"An error occurred during ticker search for query '{query}':")
        traceback.print_exc() # Log full traceback server-side only, never expose to the client
        return jsonify({"error": f"Search unavailable for '{query}' right now."}), 500


if __name__ == "__main__":
    # threaded=True keeps the dev server responsive to other requests while a
    # forecast (network-bound yfinance calls) is in progress
    app.run(debug=True, port=5000, threaded=True)