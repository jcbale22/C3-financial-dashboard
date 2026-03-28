import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, Sector, Label } from 'recharts'
import { useTheme } from '../context/ThemeContext'

const COLORS = ['#6366f1', '#10b981', '#f43f5e', '#f59e0b', '#3b82f6', '#8b5cf6', '#14b8a6', '#ec4899']

const fmt = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v)

const activeShape = (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props
  return (
    <Sector
      cx={cx} cy={cy}
      innerRadius={innerRadius - 2} outerRadius={outerRadius + 5}
      startAngle={startAngle} endAngle={endAngle}
      fill={fill}
    />
  )
}

export default function ExpenseDonut({ categories, totalBudget, totalActual, loading }) {
  const { dark } = useTheme()

  const tooltipBg     = dark ? '#17181a' : '#ffffff'
  const tooltipBorder = dark ? '#242731' : '#e2e8f0'
  const tooltipText   = dark ? '#e6e6e6' : '#0f172a'
  const legendColor   = dark ? '#b9b9b9' : '#64748b'
  const centerLabel   = dark ? '#e6e6e6' : '#0f172a'
  const centerMuted   = dark ? '#b9b9b9' : '#64748b'

  if (loading) return <div className="h-72 rounded-lg bg-skin-border animate-pulse" />

  const data = (categories ?? []).filter((c) => c.value > 0)
  if (!data.length) return (
    <div className="h-72 flex items-center justify-center text-skin-muted text-sm">No expense data</div>
  )

  const total = data.reduce((s, c) => s + c.value, 0)
  const budgetPct = totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : null
  const budgetColor = budgetPct == null ? centerMuted : budgetPct > 110 ? '#f43f5e' : budgetPct > 100 ? '#f59e0b' : '#10b981'

  const renderCenter = ({ viewBox }) => {
    const { cx, cy } = viewBox
    if (budgetPct == null) return null
    return (
      <g>
        <text x={cx} y={cy - 8} textAnchor="middle" fill={budgetColor} fontSize={24} fontWeight="700">
          {budgetPct}%
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill={centerMuted} fontSize={11}>
          of budget
        </text>
      </g>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart margin={{ top: 10, right: 10, bottom: 0, left: 10 }}>
        <Pie
          data={data} cx="50%" cy="42%"
          innerRadius={65} outerRadius={95}
          paddingAngle={2} dataKey="value"
          activeShape={activeShape} stroke="none"
        >
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          <Label content={renderCenter} position="center" />
        </Pie>
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const { name, value } = payload[0]
            const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0'
            return (
              <div style={{
                backgroundColor: tooltipBg,
                border: `1px solid ${tooltipBorder}`,
                borderRadius: 8,
                padding: '7px 12px',
                fontSize: 12,
                color: tooltipText,
                whiteSpace: 'nowrap',
              }}>
                <span style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{name}</span>
                <span style={{ color: tooltipBorder, margin: '0 8px' }}>|</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(value)}</span>
                <span style={{ color: tooltipBorder, margin: '0 8px' }}>|</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
              </div>
            )
          }}
          wrapperStyle={{ zIndex: 50, outline: 'none' }}
        />
        <Legend
          iconType="circle" iconSize={7}
          formatter={(v) => <span style={{ fontSize: 11, color: legendColor }}>{v}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
