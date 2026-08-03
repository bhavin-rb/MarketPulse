import { useState, useMemo, lazy, Suspense } from 'react'
import { fetchForecast } from './api'
import TickerSearch from './components/TickerSearch'
import logoMain from './assets/logo_main_new.png'
import './App.css'

// Lazy-loaded: recharts is the largest dependency, so charts are only
// fetched once results exist, keeping the initial page load lighter.
const StockLineChart = lazy(() => import('./components/LineChart'))
const DailyChangeChart = lazy(() => import('./components/BarChart'))
const PortfolioPieChart = lazy(() => import('./components/PieChart'))

function formatMarketCap(num) {
  if (!num) return 'N/A'
  if (num >= 1e12) {
    return `$${(num / 1e12).toFixed(2)}T`
  }
  if (num >= 1e9) {
    return `$${(num / 1e9).toFixed(2)}B`
  }
  if (num >= 1e6) {
    return `$${(num / 1e6).toFixed(2)}M`
  }
  return `$${num.toLocaleString()}`
}

export default function App() {
  const [tickerInput, setTickerInput] = useState('')
  const [startDate, setStartDate] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('forecasts')
  const [portfolioWeights, setPortfolioWeights] = useState({})
  const [selectedPreset, setSelectedPreset] = useState('equal')

  function handleReset() {
    setTickerInput('')
    setStartDate('')
    setData(null)
    setError(null)
    setActiveTab('forecasts')
    setPortfolioWeights({})
    setSelectedPreset('equal')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const tickers = tickerInput.split(',').map(t => t.trim()).filter(Boolean)
    if (!tickers.length) return
    setLoading(true)
    setError(null)
    setData(null)
    try {
      const result = await fetchForecast(tickers, startDate || null)
      setData(result)
      
      // Initialize weights to equal distribution
      if (result.stocks && result.stocks.length >= 2) {
        const N = result.stocks.length
        const equalVal = Math.floor(100 / N)
        const newWeights = {}
        result.stocks.forEach((s, idx) => {
          if (idx === N - 1) {
            newWeights[s.ticker] = 100 - (equalVal * (N - 1))
          } else {
            newWeights[s.ticker] = equalVal
          }
        })
        setPortfolioWeights(newWeights)
        setSelectedPreset('equal')
      } else {
        setPortfolioWeights({})
        setSelectedPreset('equal')
      }
      setActiveTab('forecasts')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const portfolioData = useMemo(() => {
    if (!data || data.stocks.length < 2) return null

    const total = Object.values(portfolioWeights).reduce((sum, w) => sum + w, 0)
    const isValid = total === 100

    // Gather all historical dates across all stocks to find intersections
    const historyMap = {}
    data.stocks.forEach(stock => {
      stock.history.forEach(row => {
        if (!historyMap[row.date]) {
          historyMap[row.date] = []
        }
        historyMap[row.date].push({ ticker: stock.ticker, close: row.close })
      })
    })

    const N = data.stocks.length
    const portfolioHistory = Object.entries(historyMap)
      .filter(([_, closes]) => closes.length === N)
      .map(([date, closes]) => {
        let close = 0
        closes.forEach(c => {
          const weight = (portfolioWeights[c.ticker] || 0) / 100
          close += c.close * weight
        })
        return { date, close: Math.round(close * 100) / 100 }
      })
      .sort((a, b) => a.date.localeCompare(b.date))

    // Forecast: weighted average of each stock's forecast
    const portfolioForecast = []
    const firstStockForecast = data.stocks[0].forecast
    for (let i = 0; i < 7; i++) {
      const date = firstStockForecast[i].date
      let value = 0
      let lower = 0
      let upper = 0
      data.stocks.forEach(stock => {
        const weight = (portfolioWeights[stock.ticker] || 0) / 100
        value += stock.forecast[i].value * weight
        lower += stock.forecast[i].lower * weight
        upper += stock.forecast[i].upper * weight
      })
      portfolioForecast.push({
        date,
        value: Math.round(value * 100) / 100,
        lower: Math.round(lower * 100) / 100,
        upper: Math.round(upper * 100) / 100,
      })
    }

    return {
      history: portfolioHistory,
      forecast: portfolioForecast,
      isValid
    }
  }, [data, portfolioWeights])

  const totalWeight = useMemo(() => {
    return Object.values(portfolioWeights).reduce((sum, w) => sum + w, 0)
  }, [portfolioWeights])

  function handleWeightChange(ticker, valueStr) {
    let val = parseInt(valueStr, 10)
    if (isNaN(val)) val = 0
    if (val < 0) val = 0
    if (val > 100) val = 100

    setPortfolioWeights(prev => ({
      ...prev,
      [ticker]: val
    }))
    setSelectedPreset('custom')
  }

  function handleNormalize() {
    if (!data) return
    const total = Object.values(portfolioWeights).reduce((sum, w) => sum + w, 0)
    if (total === 0) {
      const N = data.stocks.length
      const equalVal = Math.floor(100 / N)
      const newWeights = {}
      data.stocks.forEach((s, idx) => {
        if (idx === N - 1) {
          newWeights[s.ticker] = 100 - (equalVal * (N - 1))
        } else {
          newWeights[s.ticker] = equalVal
        }
      })
      setPortfolioWeights(newWeights)
      setSelectedPreset('equal')
      return
    }

    const N = data.stocks.length
    const newWeights = {}
    let sum = 0
    data.stocks.forEach((s, idx) => {
      if (idx === N - 1) {
        newWeights[s.ticker] = 100 - sum
      } else {
        const norm = Math.round((portfolioWeights[s.ticker] / total) * 100)
        newWeights[s.ticker] = norm
        sum += norm
      }
    })
    setPortfolioWeights(newWeights)
    setSelectedPreset('custom')
  }

  return (
    <div className="app">
      <nav className="app-navbar">
        <img src={logoMain} alt="Quantify Logo" className="navbar-logo" />
        <div className="navbar-status">
          <span className="status-indicator"></span>
          <span>System Online</span>
          <div className="contact-tooltip-wrapper">
            <span className="info-icon">ℹ️</span>
            <div className="contact-tooltip">
              <p>Bhavin Rasiklal Borkhataria</p>
              <p>M.Sc Financial Engineering</p>
              <p>bhavin1234@gmail.com</p>
            </div>
          </div>
        </div>

      </nav>

      <header className="app-header">
        <h1>Stock Forecast Dashboard</h1>
        <p className="subtitle">7-day ML forecast powered by linear regression</p>
      </header>

      <main className="app-main">
        <form onSubmit={handleSubmit} className="forecast-form">
          <div className="form-row">
            <div className="field">
              <label htmlFor="tickers">Tickers or company names</label>
              <TickerSearch
                id="tickers"
                name="tickers"
                value={tickerInput}
                onChange={(value) => setTickerInput(value)}
              />
            </div>
            <div className="field">
              <label htmlFor="start-date">Start date <span className="optional">(optional)</span></label>
              <input
                id="start-date"
                name="start-date"
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-forecast" disabled={loading}>
              {loading ? 'Loading...' : 'Forecast'}
            </button>
            {(data || error) && (
              <button type="button" className="btn-reset" onClick={handleReset}>Reset</button>
            )}
          </div>
          <p className="forecast-form-note">
            Forecast button is only needed when changing tickers or start date. Weight changes update automatically.
          </p>
        </form>

        {error && <p className="error-msg">{error}</p>}

        {loading && <p className="loading-msg">Fetching data and running model — this may take a few seconds...</p>}

        {data && (
          <div className="tab-navigation">
            <button
              type="button"
              className={`tab-button ${activeTab === 'forecasts' ? 'active' : ''}`}
              onClick={() => setActiveTab('forecasts')}
            >
              Forecasts
            </button>
            <button
              type="button"
              className={`tab-button ${activeTab === 'weights' ? 'active' : ''} ${data.stocks.length < 2 ? 'disabled' : ''}`}
              disabled={data.stocks.length < 2}
              onClick={() => setActiveTab('weights')}
              title={data.stocks.length < 2 ? "Custom weights are only available when more than one asset is in the portfolio." : ""}
            >
              Weights
            </button>
          </div>
        )}

        {data && data.stocks.length < 2 && (
          <div className="weights-disabled-msg">
            Custom weights are only available when more than one asset is in the portfolio.
          </div>
        )}

        {data && activeTab === 'forecasts' && (
          <Suspense fallback={<p className="loading-msg">Loading charts...</p>}>
          <section className="results">
            {data.stocks.map(stock => (
              <div key={stock.ticker} className="stock-card">
                <h2>{stock.ticker}</h2>
                <p className="stock-meta">
                  {stock.history.length} days history &middot; {stock.forecast.length}-day forecast
                </p>
                <div className="chart-section">
                  <p className="chart-label">Price history + 7-day forecast</p>
                  <p className="chart-note">Showing last 30 trading days — full history used for model training</p>
                  <StockLineChart history={stock.history} forecast={stock.forecast} />
                </div>
                <div className="chart-section">
                  <p className="chart-label">Daily % change</p>
                  <DailyChangeChart dailyChanges={stock.daily_changes} />
                </div>
              </div>
            ))}
            {data.stocks.length >= 2 && portfolioData && (
              <div className="stock-card">
                <h2>Consolidated Portfolio Forecast</h2>
                <p className="stock-meta">
                  {selectedPreset === 'equal'
                    ? 'Equal-weight'
                    : selectedPreset === 'market-cap'
                    ? 'Market-cap weight'
                    : 'Custom-weight'}{' '}
                  average across {data.stocks.length} stocks:{' '}
                  {data.stocks.map(s => `${s.ticker} (${portfolioWeights[s.ticker] || 0}%)`).join(', ')}
                </p>
                <div className="chart-section">
                  <p className="chart-label">Portfolio history + 7-day forecast</p>
                  <p className="chart-note">Showing last 30 trading days — weighted close price across selected stocks</p>
                  {portfolioData.isValid ? (
                    <StockLineChart history={portfolioData.history} forecast={portfolioData.forecast} />
                  ) : (
                    <div className="chart-placeholder-warning">
                      Please adjust weights to sum to 100% in the Weights tab to view the forecast chart.
                    </div>
                  )}
                </div>
                {portfolioData.isValid && (
                  <details className="forecast-details">
                    <summary className="forecast-details-toggle">Show 7-day forecast values</summary>
                    <div className="table-scroll">
                      <table className="forecast-table">
                        <thead>
                          <tr><th>Date</th><th>Forecast ($)</th><th>Lower ($)</th><th>Upper ($)</th></tr>
                        </thead>
                        <tbody>
                          {portfolioData.forecast.map(row => (
                            <tr key={row.date}>
                              <td>{row.date}</td>
                              <td>{row.value.toFixed(2)}</td>
                              <td>{row.lower.toFixed(2)}</td>
                              <td>{row.upper.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                )}
              </div>
            )}
          </section>
          </Suspense>
        )}

        {data && activeTab === 'weights' && data.stocks.length >= 2 && (
          <Suspense fallback={<p className="loading-msg">Loading charts...</p>}>
          <section className="results">
            <div className="stock-card">
              <h2>Portfolio Weights Configuration</h2>
              <p className="stock-meta">Configure custom weights for the portfolio assets</p>
              
              <div className="presets-container">
                <span className="presets-label">Preset:</span>
                <div className="segmented-control">
                  <button
                    type="button"
                    className={`control-btn ${selectedPreset === 'equal' ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedPreset('equal')
                      const N = data.stocks.length
                      const equalVal = Math.floor(100 / N)
                      const newWeights = {}
                      data.stocks.forEach((s, idx) => {
                        if (idx === N - 1) {
                          newWeights[s.ticker] = 100 - (equalVal * (N - 1))
                        } else {
                          newWeights[s.ticker] = equalVal
                        }
                      })
                      setPortfolioWeights(newWeights)
                    }}
                  >
                    Equal Weight
                  </button>
                  <button
                    type="button"
                    className={`control-btn ${selectedPreset === 'market-cap' ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedPreset('market-cap')
                      const N = data.stocks.length
                      const totalMc = data.stocks.reduce((sum, s) => sum + (s.market_cap || 0), 0)
                      const newWeights = {}
                      if (totalMc === 0) {
                        const equalVal = Math.floor(100 / N)
                        data.stocks.forEach((s, idx) => {
                          if (idx === N - 1) {
                            newWeights[s.ticker] = 100 - (equalVal * (N - 1))
                          } else {
                            newWeights[s.ticker] = equalVal
                          }
                        })
                      } else {
                        let sumOfProportions = 0
                        data.stocks.forEach((s, idx) => {
                          if (idx === N - 1) {
                            newWeights[s.ticker] = Math.max(0, 100 - sumOfProportions)
                          } else {
                            const prop = Math.round(((s.market_cap || 0) / totalMc) * 100)
                            newWeights[s.ticker] = prop
                            sumOfProportions += prop
                          }
                        })
                      }
                      setPortfolioWeights(newWeights)
                    }}
                  >
                    Market Cap Weight
                  </button>
                  <button
                    type="button"
                    className={`control-btn ${selectedPreset === 'custom' ? 'active' : ''}`}
                    onClick={() => setSelectedPreset('custom')}
                  >
                    Custom
                  </button>
                </div>
              </div>

              <div className="weights-list">
                {data.stocks.map(stock => {
                  const w = portfolioWeights[stock.ticker] || 0
                  return (
                    <div key={stock.ticker} className="weight-control-row">
                      <div className="weight-ticker-container">
                        <span className="weight-ticker">{stock.ticker}</span>
                        {stock.market_cap && (
                          <span className="weight-market-cap">
                            {formatMarketCap(stock.market_cap)}
                          </span>
                        )}
                      </div>
                      <input
                        id={`weight-slider-${stock.ticker}`}
                        name={`weight-slider-${stock.ticker}`}
                        type="range"
                        min="0"
                        max="100"
                        value={w}
                        onChange={(e) => handleWeightChange(stock.ticker, e.target.value)}
                        className="weight-slider"
                      />
                      <input
                        id={`weight-input-${stock.ticker}`}
                        name={`weight-input-${stock.ticker}`}
                        type="number"
                        min="0"
                        max="100"
                        value={w}
                        onChange={(e) => handleWeightChange(stock.ticker, e.target.value)}
                        className="weight-number-input"
                      />
                      <span className="weight-percentage-symbol">%</span>
                    </div>
                  )
                })}
              </div>

              <div className={`weights-validation-banner ${totalWeight === 100 ? 'valid' : 'invalid'}`}>
                <div className="validation-info">
                  <span className="validation-status-dot"></span>
                  <span>
                    {totalWeight === 100
                      ? 'Total allocation: 100% (valid)'
                      : `Total allocation: ${totalWeight}% (must equal 100%)`}
                  </span>
                </div>
                {totalWeight !== 100 && (
                  <button
                    type="button"
                    onClick={handleNormalize}
                    className="btn-normalize"
                  >
                    Normalize to 100%
                  </button>
                )}
              </div>
            </div>

            {portfolioData && (
              <div className="stock-card">
                <h2>Consolidated Portfolio Forecast</h2>
                <p className="stock-meta">
                  {selectedPreset === 'equal'
                    ? 'Equal-weight'
                    : selectedPreset === 'market-cap'
                    ? 'Market-cap weight'
                    : 'Custom-weight'}{' '}
                  average across {data.stocks.length} stocks:{' '}
                  {data.stocks.map(s => `${s.ticker} (${portfolioWeights[s.ticker] || 0}%)`).join(', ')}
                </p>
                <div className="chart-section">
                  <p className="chart-label">Portfolio history + 7-day forecast</p>
                  <p className="chart-note">Showing last 30 trading days — weighted close price across selected stocks</p>
                  {portfolioData.isValid ? (
                    <StockLineChart history={portfolioData.history} forecast={portfolioData.forecast} />
                  ) : (
                    <div className="chart-placeholder-warning">
                      Please adjust weights to sum to 100% to view the forecast chart.
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="stock-card">
              <h2>Portfolio Weights Allocation</h2>
              <p className="stock-meta">Visual distribution of asset weights</p>
              <PortfolioPieChart
                weights={(() => {
                  const pieWeightsProp = {}
                  Object.entries(portfolioWeights).forEach(([ticker, w]) => {
                    pieWeightsProp[ticker] = w / 100
                  })
                  return pieWeightsProp
                })()}
              />
            </div>
          </section>
          </Suspense>
        )}
      </main>
    </div>
  )
}
