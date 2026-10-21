import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true, // keep the session in this browser's localStorage
      autoRefreshToken: true, // renew the short-lived access token automatically
    },
  }
)