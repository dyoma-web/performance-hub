import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Avatar from '../components/Avatar'
import type { Profile } from '../types'

interface FeedbackRow {
  id: string
  user_id: string
  message: string
  images: string[]
  page: string | null
  created_at: string
}

/** Buzón de retroalimentación de la plataforma (solo admin/TH). */
export default function AdminFeedback() {
  const { profile, roles } = useAuth()
  const canManage = roles.includes('admin') || roles.includes('talento')
  const [items, setItems] = useState<FeedbackRow[]>([])
  const [people, setPeople] = useState<Profile[]>([])
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!canManage) return
    Promise.all([
      supabase.from('platform_feedback').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('profiles').select('*'),
    ]).then(async ([f, p]) => {
      const rows = (f.data as FeedbackRow[]) ?? []
      setItems(rows)
      setPeople((p.data as Profile[]) ?? [])
      // URLs firmadas (1h) para las imágenes del bucket privado
      const map: Record<string, string> = {}
      for (const row of rows) {
        for (const path of row.images) {
          const { data } = await supabase.storage.from('feedback').createSignedUrl(path, 3600)
          if (data?.signedUrl) map[path] = data.signedUrl
        }
      }
      setUrls(map)
      setLoading(false)
    })
  }, [canManage])

  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people])

  if (!profile || !canManage) {
    return <p className="py-12 text-center text-sm text-slate-400">Solo administración o Talento Humano puede ver el buzón.</p>
  }
  if (loading) return <p className="py-12 text-center text-sm text-slate-400">Cargando…</p>

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Buzón de Retroalimentación</h2>
        <p className="mt-1 text-sm font-medium text-slate-500">{items.length} mensaje(s) recibido(s)</p>
      </div>

      {items.length === 0 && (
        <p className="py-12 text-center text-sm text-slate-400">
          Aún no hay mensajes. El equipo puede enviarlos desde el botón flotante de la esquina inferior derecha.
        </p>
      )}

      {items.map((f) => {
        const author = byId.get(f.user_id)
        return (
          <div key={f.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-2 flex items-center gap-3">
              {author && <Avatar profile={author} size="h-8 w-8" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-800">{author?.name ?? 'Desconocido'}</p>
                <p className="text-[10px] text-slate-400">
                  {new Date(f.created_at).toLocaleDateString('es', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                  {f.page ? ` · desde ${f.page}` : ''}
                </p>
              </div>
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-700">{f.message}</p>
            {f.images.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {f.images.map((path) =>
                  urls[path] ? (
                    <a key={path} href={urls[path]} target="_blank" rel="noreferrer">
                      <img src={urls[path]} alt="Adjunto de retroalimentación" className="h-24 rounded-lg border border-slate-200 object-cover" />
                    </a>
                  ) : (
                    <span key={path} className="text-[10px] text-slate-400">(imagen no disponible)</span>
                  ),
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
