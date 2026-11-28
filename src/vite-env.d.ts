/// <reference types="vite/client" />

// The environment variables the site reads (src/lib/supabaseClient.ts, src/lib/gemini.ts, ...).
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
