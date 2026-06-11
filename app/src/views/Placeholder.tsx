export default function Placeholder({ title, phase }: { title: string; phase: number }) {
  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">{title}</h2>
      <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
        <span className="material-symbols-outlined text-4xl text-slate-300" aria-hidden="true">
          construction
        </span>
        <p className="mt-3 text-sm font-bold text-slate-600">Este módulo se construye en la Fase {phase} de 8</p>
        <p className="mt-1 text-xs text-slate-400">La base de datos y los permisos ya están listos.</p>
      </div>
    </div>
  )
}
