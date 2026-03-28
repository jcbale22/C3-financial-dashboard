import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useTheme } from '../context/ThemeContext'

const fmt = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v)

const shortMonth = (label) => label?.split(' ')[0] ?? label

export default function MonthlyChart({ data, loading }) {
  const { dark } = useTheme()

  const tooltipStyle = {
    backgroundColor: dark ? '#17181a' : '#ffffff',
    border: `1px solid ${dark ? '#242731' : '#e2e8f0'}`,
    borderRadius: 8,
    color: dark ? '#e6e6e6' : '#0f172a',
    fontSize: 12,
  }
  const tickColor = dark ? '#b9b9b9' : '#64748b'
  const gridColor = dark ? '#242731' : '#f1f5f9'
  const cursorColor = dark ? '#ffffff0a' : '#00000008'

  if (loading) return <div className="h-72 rounded-lg bg-skin-border animate-pulse" />

  const chartData = (data?.months ?? []).map((month, i) => ({
    month: shortMonth(month),
    Revenue: data.revenue[i] ?? 0,
    Expenses: data.expenses[i] ?? 0,
  }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: tickColor }} axisLine={false} tickLine={false} />
        <YAxis
          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
          tick={{ fontSize: 11, fill: tickColor }}
          axisLine={false} tickLine={false} width={48}
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            const revenue = payload.find((p) => p.dataKey === 'Revenue')?.value ?? 0
            const expenses = payload.find((p) => p.dataKey === 'Expenses')?.value ?? 0
            const net = revenue - expenses
            const margin = revenue > 0 ? ((net / revenue) * 100).toFixed(1) : null
            const netColor = net >= 0 ? '#10b981' : '#f43f5e'
            return (
              <div style={{ ...tooltipStyle, padding: '10px 14px', minWidth: 180 }}>
                <p style={{ fontWeight: 600, marginBottom: 8, color: dark ? '#e6e6e6' : '#0f172a' }}>{label}</p>
                {payload.map((p) => (
                  <div key={p.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 24, marginBottom: 3 }}>
                    <span style={{ color: p.color }}>{p.dataKey}</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(p.value)}</span>
                  </div>
                ))}
                <div style={{ borderTop: `1px solid ${dark ? '#242731' : '#e2e8f0'}`, marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', gap: 24 }}>
                  <span style={{ color: netColor, fontWeight: 600 }}>{net >= 0 ? 'Surplus' : 'Deficit'}</span>
                  <span style={{ color: netColor, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {net > 0 ? '+' : ''}{fmt(net)}{margin != null ? ` (${margin}%)` : ''}
                  </span>
                </div>
              </div>
            )
          }}
          cursor={{ fill: cursorColor }}
        />
        <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 12, color: tickColor, paddingTop: 12 }} />
        <Bar dataKey="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
