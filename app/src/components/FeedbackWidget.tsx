import { useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from './Toast'

const MAX_IMAGES = 3
const MAX_SIZE_MB = 3

/**
 * Buzón de retroalimentación: botón flotante discreto que abre un
 * panel con texto e imágenes opcionales. Llega a admin/TH.
 */
export default function FeedbackWidget() {
  const { profile } = useAuth()
  const toast = useToast()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [sending, setSending] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  if (!profile) return null

  function pickFiles(list: FileList | null) {
    if (!list) return
    const imgs = Array.from(list).filter((f) => f.type.startsWith('image/'))
    for (const f of imgs) {
      if (f.size > MAX_SIZE_MB * 1024 * 1024) {
        toast(`«${f.name}» supera ${MAX_SIZE_MB}MB`, 'error')
        return
      }
    }
    setFiles((prev) => [...prev, ...imgs].slice(0, MAX_IMAGES))
  }

  async function send() {
    if (message.trim().length < 5) return toast('Cuéntanos un poco más (mínimo 5 caracteres)', 'error')
    setSending(true)
    try {
      const paths: string[] = []
      for (const f of files) {
        const path = `${profile!.id}/${Date.now()}-${f.name.replace(/[^\w.-]/g, '_')}`
        const { error } = await supabase.storage.from('feedback').upload(path, f)
        if (error) throw new Error(`No se pudo subir ${f.name}: ${error.message}`)
        paths.push(path)
      }
      const { error } = await supabase.from('platform_feedback').insert({
        user_id: profile!.id,
        message: message.trim(),
        images: paths,
        page: location.pathname,
      })
      if (error) throw new Error(error.message)
      // Aviso in-app a admin/TH
      const { data: admins } = await supabase
        .from('profiles')
        .select('id, role')
        .in('role', ['admin', 'talento'])
        .eq('is_active', true)
      if (admins && admins.length > 0) {
        await supabase.from('notifications').insert(
          admins.map((a) => ({
            user_id: a.id,
            type: 'feedback',
            title: 'Nueva retroalimentación en el buzón',
            body: `${profile!.name}: ${message.trim().slice(0, 120)}${message.trim().length > 120 ? '…' : ''}`,
            link: '/buzon',
          })),
        )
      }
      setMessage('')
      setFiles([])
      setOpen(false)
      toast('✓ ¡Gracias! Tu retroalimentación fue enviada')
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      {/* Botón flotante discreto */}
      <button
        onClick={() => setOpen((o) => !o)}
        title="Enviar retroalimentación"
        aria-label="Enviar retroalimentación"
        className="fixed right-5 bottom-5 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-400 shadow-lg ring-1 ring-slate-200 transition-all hover:text-primary hover:shadow-xl"
      >
        <span className="material-symbols-outlined text-xl" aria-hidden="true">
          {open ? 'close' : 'maps_ugc'}
        </span>
      </button>

      {open && (
        <div className="fixed right-5 bottom-20 z-40 w-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
          <p className="text-sm font-extrabold tracking-tight text-slate-900">¿Ideas o problemas?</p>
          <p className="mb-3 text-[11px] text-slate-500">
            Tu mensaje llega directo a administración y Talento Humano.
          </p>
          <textarea
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Escribe tu retroalimentación…"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                pickFiles(e.target.files)
                e.target.value = ''
              }}
            />
            <button
              onClick={() => fileInput.current?.click()}
              disabled={files.length >= MAX_IMAGES}
              className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-bold text-slate-500 hover:bg-slate-200 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-sm" aria-hidden="true">image</span>
              Adjuntar ({files.length}/{MAX_IMAGES})
            </button>
            {files.map((f, i) => (
              <span key={i} className="flex items-center gap-1 rounded-lg bg-primary/5 px-2 py-1 text-[10px] font-semibold text-primary">
                {f.name.length > 16 ? f.name.slice(0, 14) + '…' : f.name}
                <button onClick={() => setFiles((prev) => prev.filter((_, x) => x !== i))} aria-label={`Quitar ${f.name}`}>
                  <span className="material-symbols-outlined text-xs" aria-hidden="true">close</span>
                </button>
              </span>
            ))}
          </div>
          <button
            onClick={send}
            disabled={sending}
            className="mt-3 w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:brightness-105 disabled:opacity-60"
          >
            {sending ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      )}
    </>
  )
}
