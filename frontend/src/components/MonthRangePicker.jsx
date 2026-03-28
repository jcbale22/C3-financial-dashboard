const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const PRESETS = [
  { label: 'Q1', start: 1,  end: 3  },
  { label: 'Q2', start: 4,  end: 6  },
  { label: 'Q3', start: 7,  end: 9  },
  { label: 'Q4', start: 10, end: 12 },
  { label: 'YTD', start: 1, end: null }, // end filled in dynamically
  { label: 'Full Year', start: 1, end: 12 },
]

export default function MonthRangePicker({ year, start, end, onChange }) {
  const now = new Date()
  const currentYear  = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  // For past years all months exist; for the current year cap at today's month
  const ytdEnd = year < currentYear ? 12 : Math.min(currentMonth, 12)

  const activePreset = PRESETS.find((p) => {
    const pEnd = p.label === 'YTD' ? ytdEnd : p.end
    return p.start === start && pEnd === end
  })?.label ?? null

  const applyPreset = (preset) => {
    const pEnd = preset.label === 'YTD' ? ytdEnd : preset.end
    onChange(preset.start, pEnd)
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">

      {/* Preset pills */}
      <div className="flex items-center gap-1">
        {PRESETS.map((p) => {
          const isActive = activePreset === p.label
          return (
            <button
              key={p.label}
              onClick={() => applyPreset(p)}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors shadow-sm ${
                isActive
                  ? 'bg-skin-primary text-skin-bg'
                  : 'bg-skin-surface2 text-skin-muted hover:text-skin-fg hover:bg-skin-border'
              }`}
            >
              {p.label}
            </button>
          )
        })}
      </div>

      {/* Divider */}
      <div className="h-4 w-px bg-skin-border" />

      {/* Manual range selectors */}
      <div className="flex items-center gap-1.5 text-xs">
        <select
          value={start}
          onChange={(e) => {
            const s = Number(e.target.value)
            onChange(s, Math.max(s, end))
          }}
          className="bg-skin-surface2 border border-skin-border text-skin-fg rounded px-2 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-skin-primary cursor-pointer shadow-sm"
        >
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>{m}</option>
          ))}
        </select>
        <span className="text-skin-muted">–</span>
        <select
          value={end}
          onChange={(e) => {
            const e_ = Number(e.target.value)
            onChange(Math.min(start, e_), e_)
          }}
          className="bg-skin-surface2 border border-skin-border text-skin-fg rounded px-2 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-skin-primary cursor-pointer shadow-sm"
        >
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>{m}</option>
          ))}
        </select>
        <span className="text-skin-muted">{year}</span>
      </div>

    </div>
  )
}
