import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const SLICE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#84cc16']

export default function PortfolioPieChart({ weights }) {
  const data = Object.entries(weights).map(([ticker, weight]) => ({
    name: ticker,
    value: Math.round(weight * 100),
  }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={100}
          label={({ name, value }) => `${name} ${value}%`}
          labelLine={{ stroke: '#475569' }}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={SLICE_COLORS[i % SLICE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ background: '#1e2130', border: '1px solid #334155', borderRadius: 6 }}
          formatter={v => [`${v}%`, 'Weight']}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
      </PieChart>
    </ResponsiveContainer>
  )
}
