import {
  ComposedChart, Line, Area, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

const formatDate = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function StockLineChart({ history, forecast }) {
  // Show only last 30 trading days of history so the 7-day forecast
  // occupies a visible share (~19%) of the chart width.
  const visibleHistory = history.slice(-30)
  const boundaryDate = visibleHistory[visibleHistory.length - 1]?.date

  const combined = [
    ...visibleHistory.map(d => ({ date: d.date, close: d.close })),
    ...forecast.map(d => ({
      date: d.date,
      value: d.value,
      // stackId band: transparent base up to lower, then colored fill to upper
      lower: d.lower,
      bandHeight: parseFloat((d.upper - d.lower).toFixed(2)),
    })),
  ]

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={combined} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          tick={{ fill: '#64748b', fontSize: 11 }}
          interval="preserveStartEnd"
          minTickGap={50}
        />
        <YAxis
          tick={{ fill: '#64748b', fontSize: 11 }}
          tickFormatter={v => `$${v}`}
          domain={['auto', 'auto']}
          width={65}
        />
        <Tooltip
          contentStyle={{ background: '#1e2130', border: '1px solid #334155', borderRadius: 6 }}
          labelStyle={{ color: '#94a3b8', fontSize: 12 }}
          labelFormatter={formatDate}
          formatter={(value, name) => {
            if (name === 'lower' || name === 'bandHeight') return null
            return [`$${Number(value).toFixed(2)}`, name === 'close' ? 'History' : 'Forecast']
          }}
        />
        <Legend
          formatter={name => name === 'close' ? 'History' : name === 'value' ? 'Forecast' : null}
          wrapperStyle={{ fontSize: 12, color: '#94a3b8' }}
        />
        {/* Confidence band: transparent base stacked with colored fill */}
        <Area type="monotone" dataKey="lower" stackId="band" stroke="none" fill="transparent"
          dot={false} activeDot={false} legendType="none" connectNulls={false} />
        <Area type="monotone" dataKey="bandHeight" stackId="band" stroke="none"
          fill="#10b981" fillOpacity={0.15}
          dot={false} activeDot={false} legendType="none" connectNulls={false} />
        {/* History — indigo */}
        <Line type="monotone" dataKey="close" stroke="#6366f1" strokeWidth={2}
          dot={false} connectNulls={false} />
        {/* Forecast — emerald dashed, larger dots for visibility */}
        <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2.5}
          strokeDasharray="5 3" dot={{ r: 5, fill: '#10b981', strokeWidth: 0 }} activeDot={{ r: 7 }} connectNulls={false} />
        {/* Vertical line marking start of forecast */}
        {boundaryDate && (
          <ReferenceLine x={boundaryDate} stroke="#475569" strokeDasharray="4 3"
            label={{ value: 'Forecast', position: 'insideTopRight', fill: '#10b981', fontSize: 11 }} />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
