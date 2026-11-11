const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY must be configured.')
}

export const config = Object.freeze({
  port: process.env.PORT || 3001,
  trustedProxyHops: Number.parseInt(process.env.TRUST_PROXY_HOPS || (process.env.VERCEL ? '1' : '0'), 10),
  modelName: process.env.GEMINI_MODEL,
  geminiApiKey: process.env.GEMINI_API_KEY,
  supabaseUrl,
  supabaseServiceRoleKey,
  maxHistoryMessages: 7,
  geminiTimeoutMs: 12000,
  embeddingModel: 'gemini-embedding-001',
  embeddingDimensions: 768,
  ragMatchCount: 4,
  ragMatchThreshold: 0.3,
  ragTimeoutMs: 4000,
})
