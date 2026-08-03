import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Cell, ReferenceLine, ResponsiveContainer,
} from 'recharts'

const formatDate = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function DailyChangeChart({ dailyChanges }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={dailyChanges} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          tick={{ fill: '#64748b', fontSize: 11 }}
          interval="preserveStartEnd"
          minTickGap={50}
        />
        <YAxis
          tick={{ fill: '#64748b', fontSize: 11 }}
          tickFormatter={v => `${v}%`}
          width={50}
        />
        <Tooltip
          contentStyle={{ background: '#1e2130', border: '1px solid #334155', borderRadius: 6 }}
          labelStyle={{ color: '#94a3b8', fontSize: 12 }}
          labelFormatter={formatDate}
          //formatter={v => [`${Number(v).toFixed(2)}%`, 'Daily change']}
          formatter={v => [
            <span style={{ color: v >= 0 ? '#22c55e' : '#ef4444' }}>
              {Number(v).toFixed(2)}%
            </span>,
            'Daily change'
          ]}
          itemStyle={{ color: '#94a3b8' }} // styles the label text
        />
        <ReferenceLine y={0} stroke="#334155" />
        <Bar dataKey="change" radius={[2, 2, 0, 0]} maxBarSize={12}>
          {dailyChanges.map((entry, i) => (
            <Cell key={i} fill={entry.change >= 0 ? '#3b82f6' : '#ef4444'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
