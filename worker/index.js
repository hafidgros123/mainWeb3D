import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { ANIMATION_NAMES } from '../src/three/animations.js'

const app = new Hono()

// --- Fixed settings (same values your config.js used) ---------------------
const MAX_HISTORY_MESSAGES = 7
const GEMINI_TIMEOUT_MS = 12000
const EMBEDDING_MODEL = 'gemini-embedding-001'
const EMBEDDING_DIMENSIONS = 768
const RAG_MATCH_COUNT = 4
const RAG_MATCH_THRESHOLD = 0.3
const RAG_TIMEOUT_MS = 4000

const SYSTEM_INSTRUCTION = `You are Ellen, a goth girl in her early 20s.
You still kinda try to help the user, but you are not very enthusiastic about it.
You are a bit lazy, but you still get things done eventually.
You never use exclamation marks or sound excited.
You often leave comments on the user's questions, like "really?" or "wow, that's a question" or "sure ig", "whatever".
when the user ask a question about the site , you first tell him there is an FAQ page and then you answer the question from the rag documentation you have access to, if you don't know the answer, you say "I don't know" or "I don't have that information" or "I can't help with that", you never make up an answer.
Keep replies concise and direct. Do not explain your reasoning unless asked.
You always answer.`

// --- Lazily-created clients, cached for the lifetime of this isolate ------
let cachedSupabase = null
let cachedSupabaseUrl = null
function getSupabaseAdmin(env) {
  if (!cachedSupabase || cachedSupabaseUrl !== env.SUPABASE_URL) {
    cachedSupabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    cachedSupabaseUrl = env.SUPABASE_URL
  }
  return cachedSupabase
}

let cachedGemini = null
let cachedGeminiKey = null
function getGeminiClient(apiKey) {
  if (!cachedGemini || cachedGeminiKey !== apiKey) {
    cachedGemini = new GoogleGenerativeAI(apiKey)
    cachedGeminiKey = apiKey
  }
  return cachedGemini
}

// --- CORS: your frontend's real domain goes in the ALLOWED_ORIGIN secret --
app.use('/api/*', async (c, next) => {
  const corsMiddleware = cors({
    origin: c.env.ALLOWED_ORIGIN || 'http://localhost:5173',
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
  })
  return corsMiddleware(c, next)
})

// --- Auth: same idea as requireUser before, now as Hono middleware --------
async function requireUser(c, next) {
  const authHeader = c.req.header('Authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return c.json({ error: 'Sign in to chat with Ellen.' }, 401)
  }

  const supabaseAdmin = getSupabaseAdmin(c.env)
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data?.user) {
    return c.json({ error: 'Your session expired. Please sign in again.' }, 401)
  }

  c.set('user', data.user)
  c.set('supabaseAdmin', supabaseAdmin)
  await next()
}

// --- Simple per-IP flood guard (module-scope Map, same caveat as before:
// it resets whenever this isolate gets recycled — fine, it's just a flood
// guard, the real per-user/day limit is enforced in Postgres below) --------
const ipHits = new Map()
function checkIpLimit(ip) {
  const now = Date.now()
  const windowMs = 15 * 60 * 1000
  const limit = 30
  const entry = ipHits.get(ip)
  if (!entry || now - entry.start > windowMs) {
    ipHits.set(ip, { start: now, count: 1 })
    return true
  }
  entry.count += 1
  return entry.count <= limit
}

function extractSlashCommand(message) {
  if (typeof message !== 'string') return null
  const match = message.trim().match(/(?:^|\s)(\/\w+)/i)
  return match ? match[1].toLowerCase() : null
}

const tools = [
  {
    functionDeclarations: [
      {
        name: 'playAnimation',
        description: 'Plays a predefined animation on the 3D character.',
        parameters: {
          type: 'object',
          properties: {
            animation: { type: 'string', enum: ANIMATION_NAMES },
          },
          required: ['animation'],
        },
      },
    ],
  },
]

function buildGenerationConfig(isCommand) {
  const generationConfig = {}
  if (!isCommand) generationConfig.maxOutputTokens = 100
  generationConfig.thinkingConfig = { thinkingLevel: 'minimal' }
  return generationConfig
}

function prepareHistory(history) {
  if (!Array.isArray(history)) return []
  let trimmed = history.slice(-MAX_HISTORY_MESSAGES)
  while (trimmed.length > 0 && trimmed[0]?.role !== 'user') {
    trimmed = trimmed.slice(1)
  }
  return trimmed
}

async function embedQuery(apiKey, text) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), RAG_TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      signal: controller.signal,
      body: JSON.stringify({
        model: `models/${EMBEDDING_MODEL}`,
        content: { parts: [{ text }] },
        taskType: 'RETRIEVAL_QUERY',
        outputDimensionality: EMBEDDING_DIMENSIONS,
      }),
    })
    if (!res.ok) throw new Error(`embedContent failed (${res.status}): ${await res.text()}`)
    const json = await res.json()
    return json.embedding?.values ?? null
  } finally {
    clearTimeout(timeout)
  }
}

async function retrieveFaqContext(supabaseAdmin, apiKey, message) {
  try {
    const queryEmbedding = await embedQuery(apiKey, message)
    if (!queryEmbedding) return ''

    const { data, error } = await supabaseAdmin.rpc('match_kb_chunks', {
      query_embedding: queryEmbedding,
      match_count: RAG_MATCH_COUNT,
      match_threshold: RAG_MATCH_THRESHOLD,
    })
    if (error) throw error
    if (!data?.length) return ''

    const entries = data.map((row) => `- ${row.content.replaceAll('\n', ' ')}`).join('\n')
    return `\n\nRelevant facts about the website, from the FAQ (use these to answer if relevant, but stay in character):\n${entries}`
  } catch (error) {
    console.warn('RAG retrieval skipped:', error.message || error)
    return ''
  }
}

async function runChat({ apiKey, modelName, message, history, isCommand, systemInstruction }) {
  const model = getGeminiClient(apiKey).getGenerativeModel(
    {
      model: modelName,
      systemInstruction,
      generationConfig: buildGenerationConfig(isCommand),
      ...(isCommand ? { tools } : {}),
    },
    { timeout: GEMINI_TIMEOUT_MS },
  )
  const chat = model.startChat({ history })
  return chat.sendMessageStream(isCommand ? message.trim().slice(1) : message)
}

const RETRYABLE_STATUSES = new Set([429, 500, 503, 504])

async function withRetry(task, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await task()
    } catch (error) {
      const canRetry = RETRYABLE_STATUSES.has(error?.status) && i < attempts - 1
      if (!canRetry) throw error
      console.warn(`Gemini returned ${error.status}, retrying (${i + 1}/${attempts - 1})...`)
      await new Promise((resolve) => setTimeout(resolve, 600 * (i + 1)))
    }
  }
}

async function logMessage(supabaseAdmin, userId, role, content) {
  if (!content) return
  const { error } = await supabaseAdmin.from('chat_messages').insert({
    user_id: userId,
    role,
    content,
  })
  if (error) console.error('Failed to store chat message:', error)
}

// --- Routes -----------------------------------------------------------

app.get('/api/health', (c) => c.json({ ok: true }))

app.post('/api/delete-account', requireUser, async (c) => {
  const supabaseAdmin = c.get('supabaseAdmin')
  const userId = c.get('user').id

  const { data: adminRow, error: adminError } = await supabaseAdmin
    .from('admins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (adminError) {
    console.error('Failed to check gamble admin status:', adminError)
    return c.json({ error: 'Could not check account status.' }, 500)
  }

  if (adminRow) {
    const { error: commentsError } = await supabaseAdmin
      .from('comments')
      .update({ is_admin: false })
      .eq('user_id', userId)
    if (commentsError) {
      console.error('Failed to remove admin badges:', commentsError)
      return c.json({ error: 'Could not remove admin status.' }, 500)
    }

    const { error: adminDeleteError } = await supabaseAdmin
      .from('admins')
      .delete()
      .eq('user_id', userId)
    if (adminDeleteError) {
      console.error('Failed to demote gamble admin:', adminDeleteError)
      return c.json({ error: 'Could not remove admin status.' }, 500)
    }
    return c.json({ deleted: false })
  }

  const { error: commentsError } = await supabaseAdmin.from('comments').delete().eq('user_id', userId)
  const { error: chatError } = await supabaseAdmin.from('chat_messages').delete().eq('user_id', userId)
  const { error: profileError } = await supabaseAdmin.from('profiles').delete().eq('id', userId)
  if (commentsError || chatError || profileError) {
    console.error('Failed to remove account data:', commentsError || chatError || profileError)
    return c.json({ error: 'Could not remove account data.' }, 500)
  }

  const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)
  if (authDeleteError) {
    console.error('Failed to delete Supabase Auth account:', authDeleteError)
    return c.json({ error: 'Could not delete the Auth account.' }, 500)
  }
  return c.json({ deleted: true })
})

app.post('/api/chat', requireUser, async (c) => {
  const supabaseAdmin = c.get('supabaseAdmin')
  const user = c.get('user')
  const { message, history = [] } = await c.req.json()
  const apiKey = c.env.GEMINI_API_KEY
  const modelName = c.env.GEMINI_MODEL

  if (!apiKey) return c.json({ error: 'GEMINI_API_KEY is not configured' }, 500)
  if (typeof message !== 'string' || !message.trim()) return c.json({ error: 'message is required' }, 400)

  // Same exemption as your original server.js: a message containing a
  // /command anywhere (not just at the start) skips the per-IP flood guard.
  // The per-user/day limit below still applies to commands regardless.
  const isExemptFromIpLimit = Boolean(extractSlashCommand(message))
  if (!isExemptFromIpLimit) {
    const ip = c.req.header('CF-Connecting-IP') || 'unknown'
    if (!checkIpLimit(ip)) {
      return c.json({ error: 'Too many chat messages from this network. Please wait 15 minutes before trying again.' }, 429)
    }
  }

  const { data: limitRows, error: limitError } = await supabaseAdmin.rpc('consume_chat_message_limit', {
    p_user_id: user.id,
  })
  if (limitError) {
    console.error('Failed to enforce daily chat limits:', limitError)
    return c.json({ error: 'Chat limits are temporarily unavailable. Please try again later.' }, 503)
  }
  const limit = limitRows?.[0]
  if (!limit || typeof limit.allowed !== 'boolean') {
    console.error('The daily chat limit function returned an invalid result:', limitRows)
    return c.json({ error: 'Chat limits are temporarily unavailable. Please try again later.' }, 503)
  }
  if (!limit.allowed) {
    const error = limit.reason === 'user'
      ? 'You have reached your daily chat limit. Please try again after the daily reset.'
      : 'The chatbot has reached its daily limit. Please try again after the daily reset.'
    return c.json({ error }, 429)
  }

  const isCommand = message.trim().startsWith('/')
  const preparedHistory = prepareHistory(history)
  const startedAt = Date.now()

  logMessage(supabaseAdmin, user.id, 'user', message)

  const faqContext = isCommand ? '' : await retrieveFaqContext(supabaseAdmin, apiKey, message)
  const systemInstruction = SYSTEM_INSTRUCTION + faqContext

  let result
  try {
    result = await withRetry(() => runChat({
      apiKey,
      modelName,
      message,
      history: preparedHistory,
      isCommand,
      systemInstruction,
    }))
  } catch (error) {
    console.error(`Gemini failed after ${Date.now() - startedAt}ms (status ${error?.status ?? 'none'}):`, error)
    return c.json({ error: 'Gemini request failed' }, 502)
  }

  const encoder = new TextEncoder()
  let streamedText = ''

  const body = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of result.stream) {
          const parts = chunk.candidates?.[0]?.content?.parts ?? []
          for (const part of parts) {
            if (part.text) {
              streamedText += part.text
              controller.enqueue(encoder.encode(`${JSON.stringify({ type: 'token', text: part.text })}\n`))
            }
          }
        }

        const finalResponse = await result.response
        const parts = finalResponse.candidates?.[0]?.content?.parts ?? []
        const replyText = streamedText || parts.find((part) => part.text)?.text || ''
        const functionCall = parts.find((part) => part.functionCall)?.functionCall ?? null
        if (replyText) logMessage(supabaseAdmin, user.id, 'assistant', replyText)
        controller.enqueue(encoder.encode(`${JSON.stringify({ type: 'done', functionCall })}\n`))
        console.log(`Gemini (${modelName}) answered in ${Date.now() - startedAt}ms${faqContext ? ' (with FAQ context)' : ''}`)
      } catch (error) {
        console.error(`Gemini stream failed after ${Date.now() - startedAt}ms:`, error)
        controller.enqueue(encoder.encode(`${JSON.stringify({ type: 'error', message: 'Gemini request failed' })}\n`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
    },
  })
})

export default app