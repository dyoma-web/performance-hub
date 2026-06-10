export default function App() {
  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="view-enter w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20">
          <span className="material-symbols-outlined text-3xl text-white" aria-hidden="true">
            insights
          </span>
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
          Hub<span className="text-primary">.</span>
        </h1>
        <p className="mt-1 text-[10px] font-bold tracking-widest text-slate-400 uppercase">
          Performance
        </p>
        <p className="mt-6 text-sm font-semibold text-slate-500">
          Fundación lista — Fase 1 de 8
        </p>
        <div className="mt-4 flex justify-center gap-2" aria-hidden="true">
          <span className="h-2 w-2 rounded-full bg-primary" />
          <span className="h-2 w-2 rounded-full bg-accent" />
          <span className="h-2 w-2 rounded-full bg-highlight" />
        </div>
      </div>
    </div>
  )
}
