// lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js'

let supabase: ReturnType<typeof createClient> | null = null

export function getSupabase() {
  if (supabase) return supabase
  const config = useRuntimeConfig()
  const url = (config.public.supabaseUrl as string) || 'http://localhost:54321'
  const key = (config.public.supabaseAnonKey as string) || 'mock-key'
  supabase = createClient(url, key, {
    auth: {
      storage: typeof window !== 'undefined' ? localStorage : undefined,
      autoRefreshToken: true, persistSession: true, detectSessionInUrl: true,
    },
  })
  return supabase
}
