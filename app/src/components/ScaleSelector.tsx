import { SCALE } from '../lib/scale'

export default function ScaleSelector({
  value,
  onChange,
  disabled = false,
  label,
}: {
  value: number | null
  onChange: (v: number) => void
  disabled?: boolean
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={`Calificación: ${label}`} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {SCALE.map((s) => {
        const selected = value === s.value
        return (
          <button
            key={s.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            title={s.description}
            onClick={() => onChange(s.value)}
            className={`flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-sm transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
              selected
                ? 'border-primary bg-primary/5 font-bold ring-2 ring-primary/30'
                : 'border-slate-200 bg-white hover:border-primary/50'
            }`}
          >
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                selected ? 'bg-primary text-white' : 'border-2 border-slate-200 text-slate-500'
              }`}
              aria-hidden="true"
            >
              {s.value}
            </span>
            <span className="text-center text-[10px] leading-tight">{s.label}</span>
          </button>
        )
      })}
    </div>
  )
}
