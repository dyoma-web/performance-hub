import { createClient } from '@supabase/supabase-js'

// Las credenciales se configuran en app/.env.local (ver .env.example).
// Se conectan en la Fase 2 (esquema de datos) y Fase 3 (auth).
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
