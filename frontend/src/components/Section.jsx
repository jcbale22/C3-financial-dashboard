import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

export default function Section({ title, icon: Icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="rounded-xl border border-skin-border overflow-hidden shadow-lg">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 bg-skin-surface hover:bg-skin-surface2 transition-colors"
      >
        <div className="flex items-center gap-3">
          {Icon && <Icon size={15} className="text-skin-primary" />}
          <span className="text-sm font-semibold text-skin-fg tracking-wide">{title}</span>
        </div>
        <ChevronDown
          size={15}
          className={`text-skin-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="bg-skin-surface border-t border-skin-border p-5">
          {children}
        </div>
      )}
    </div>
  )
}
