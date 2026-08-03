from flask import Flask, request, jsonify
from flask_cors import CORS
from forecaster import run_forecast

app = Flask(__name__)
CORS(app, origins=["http://localhost:5173"])

# Company name → ticker symbol (case-insensitive lookup)
TICKER_MAP = {
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
    return TICKER_MAP.get(name.lower().strip(), name.upper().strip())


@app.route("/api/forecast", methods=["POST"])
def forecast():
    body = request.get_json(force=True, silent=True) or {}
    tickers_raw = body.get("tickers", [])
    start_date = body.get("start_date") or None

    if not tickers_raw:
        return jsonify({"error": "tickers field is required and must be a non-empty list"}), 400

    tickers = [resolve_ticker(t) for t in tickers_raw]
    stocks = []

    for ticker in tickers:
        try:
            data = run_forecast(ticker, start_date=start_date)
            stocks.append(data)
        except ValueError as e:
            return jsonify({"error": str(e)}), 404
        except Exception as e:
            return jsonify({"error": f"Forecast failed for {ticker}: {str(e)}"}), 500

    n = len(tickers)
    weights = {t: round(1 / n, 4) for t in tickers}

    # Consolidated portfolio: equal-weight average across all stocks (only for ≥ 2 tickers)
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

    return jsonify({"stocks": stocks, "weights": weights, "portfolio": portfolio})


if __name__ == "__main__":
    app.run(debug=True, port=5000)
