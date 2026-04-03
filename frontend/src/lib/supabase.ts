import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string).trim()
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string).trim()

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  if (!data.session) return null

  // Refresh the token if it expires within the next 60 seconds
  const expiresAt = (data.session.expires_at ?? 0) * 1000
  if (expiresAt - Date.now() < 60_000) {
    const { data: refreshed } = await supabase.auth.refreshSession()
    return refreshed.session?.access_token ?? null
  }

  return data.session.access_token
}
