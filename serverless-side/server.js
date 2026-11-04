import express from 'express'
import { rateLimit } from 'express-rate-limit'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'
import { ANIMATION_NAMES } from '../src/three/animations.js'

const app = express()
const port = process.env.PORT || 3001
const trustedProxyHops = Number.parseInt(process.env.TRUST_PROXY_HOPS || '0', 10)

// --- Speed settings -------------------------------------------------------
// Change the model without touching code: GEMINI_MODEL=<model id> in your env.
const MODEL_NAME = process.env.GEMINI_MODEL
// Only the last N messages are sent to Gemini. Less input = faster reply.
const MAX_HISTORY_MESSAGES = 7
// Give up on Gemini before the browser's 30s axios timeout does.
const GEMINI_TIMEOUT_MS = 12000
// Tries to turn "thinking" off. If the model/SDK rejects it, the server
// falls back automatically and stops trying (see the chat route).
let thinkingConfigSupported = true

const SYSTEM_INSTRUCTION = `You are Ellen, a goth girl in her early 20s.
You still kinda try to help the user, but you are not very enthusiastic about it.
You are a bit lazy, but you still get things done eventually.
You never use exclamation marks or sound excited.
You often leave comments on the user's questions, like "really?" or "wow, that's a question" or "sure ig", "whatever".
when the user ask a question about the site , you first tell him there is an FAQ page and then you answer the question from the rag documentation you have access to, if you don't know the answer, you say "I don't know" or "I don't have that information" or "I can't help with that", you never make up an answer.
You always answer.`

// --- RAG (FAQ knowledge base) settings -------------------------------------
// Must match scripts/ingest_faq.js: same embedding model, same dimensions.
const EMBEDDING_MODEL = 'gemini-embedding-001'
const EMBEDDING_DIMENSIONS = 768
// How many FAQ chunks to pull in as context, and how relevant they must be
// (cosine similarity 0-1) to bother including. Tune match_threshold down if
// Ellen isn't finding relevant FAQ entries for reasonable questions.
const RAG_MATCH_COUNT = 4
const RAG_MATCH_THRESHOLD = 0.3
// Don't let a slow/stuck embedding call hold up the whole chat reply.
const RAG_TIMEOUT_MS = 4000

// --- Supabase (server-side, service role) ---------------------------------
// This is the SECRET service-role key, never the anon/publishable key, and it
// must never be shipped to the browser. It lets the server verify who's
// calling (via their access token) and write chat rows under RLS.
const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.')
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// Requires a valid Supabase session. The client sends the user's access
// token as `Authorization: Bearer <token>`; we ask Supabase who that is.
// This replaces the old anonymous-cookie session: identity now comes from
// a real signed-in account, which is also what chat rows get tagged with.
async function requireUser(request, response, next) {
  const authHeader = request.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return response.status(401).json({ error: 'Sign in to chat with Ellen.' })
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data?.user) {
    return response.status(401).json({ error: 'Your session expired. Please sign in again.' })
  }

  request.user = data.user
  next()
}

// --- Gemini client (created once, reused for every request) ---------------
let cachedClient = null
let cachedClientKey = null

function getClient(apiKey) {
  if (!cachedClient || cachedClientKey !== apiKey) {
    cachedClient = new GoogleGenerativeAI(apiKey)
    cachedClientKey = apiKey
  }
  return cachedClient
}

// Keeps only the last messages, and makes sure the history starts with a
// "user" turn (Gemini rejects histories that start with a "model" turn).
function prepareHistory(history) {
  if (!Array.isArray(history)) return []
  let trimmed = history.slice(-MAX_HISTORY_MESSAGES)
  while (trimmed.length > 0 && trimmed[0]?.role !== 'user') {
    trimmed = trimmed.slice(1)
  }
  return trimmed
}

const extractSlashCommand = (message) => {
  if (typeof message !== 'string') return null
  const match = message.trim().match(/(?:^|\s)(\/\w+)/i)
  return match ? match[1].toLowerCase() : null
}

const isSlashCommand = (request) => (
  typeof request.body?.message === 'string' && Boolean(extractSlashCommand(request.body.message))
)

if (trustedProxyHops > 0) {
  app.set('trust proxy', trustedProxyHops)
}

const perIpChatLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isSlashCommand,
  handler: (_request, response) => response.status(429).json({
    error: 'Too many chat messages from this network. Please wait 15 minutes before trying again.',
  }),
})

// Keyed by the signed-in user's id instead of an anonymous cookie.
const perUserChatLimit = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: 20,
  keyGenerator: (request) => `chat-user:${request.user.id}`,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isSlashCommand,
  handler: (_request, response) => response.status(429).json({
    error: 'You have reached your daily chat limit. Please try again later.',
  }),
})

const dailyChatLimit = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: 100,
  keyGenerator: () => 'all-normal-chat',
  standardHeaders: true,
  legacyHeaders: false,
  skip: isSlashCommand,
  handler: (_request, response) => response.status(429).json({
    error: 'The chatbot has reached its daily limit. Please try again later.',
  }),
})

app.use(express.json())
app.use((request, response, next) => {
  response.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  if (request.method === 'OPTIONS') return response.sendStatus(204)
  next()
})

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
  const config = {}

  if (!isCommand) config.maxOutputTokens = 100
  config.thinkingConfig = { thinkingLevel: 'minimal' }

  return config
}

// --- RAG: embed the user's question and fetch matching FAQ chunks ---------
// Uses raw fetch instead of the Gemini SDK's embedContent, because the SDK
// (@google/generative-ai) predates outputDimensionality support, which we
// need to get 768-dim vectors matching kb_chunks.embedding.
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
        // RETRIEVAL_QUERY (not RETRIEVAL_DOCUMENT, which the ingestion script
        // uses) — Gemini embeds queries and documents differently on purpose.
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

// Returns a context string to prepend to the system instruction, or '' if
// nothing relevant was found or anything failed. RAG is a nice-to-have:
// any failure here must never break the chat reply the user is waiting on.
async function retrieveFaqContext(apiKey, message) {
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

async function runChat({ apiKey, message, history, isCommand, systemInstruction }) {
  const model = getClient(apiKey).getGenerativeModel(
    {
      model: MODEL_NAME,
      systemInstruction,
     generationConfig: buildGenerationConfig(isCommand),
      ...(isCommand ? { tools } : {}),
    },
    { timeout: GEMINI_TIMEOUT_MS },
  )
  const chat = model.startChat({ history })
  return chat.sendMessage(isCommand ? message.trim().slice(1) : message)
}

// Temporary Google errors (overloaded, rate limited, hiccups) usually clear up
// in a second or two, so retry quietly instead of showing an error in the chat.
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

// Fire-and-forget persistence: a logging failure should never break the chat
// reply the user is waiting on, so we only log Supabase errors here.
async function logMessage(userId, role, content) {
  if (!content) return
  const { error } = await supabaseAdmin.from('chat_messages').insert({
    user_id: userId,
    role,
    content,
  })
  if (error) console.error('Failed to store chat message:', error)
}

app.get('/api/health', (request, response) => {
  response.json({ ok: true })
})

app.post('/api/delete-account', requireUser, async (request, response) => {
  const userId = request.user.id
  const { data: adminRow, error: adminError } = await supabaseAdmin
    .from('admins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (adminError) {
    console.error('Failed to check gamble admin status:', adminError)
    return response.status(500).json({ error: 'Could not check account status.' })
  }

  if (adminRow) {
    const { error: commentsError } = await supabaseAdmin
      .from('comments')
      .update({ is_admin: false })
      .eq('user_id', userId)
    if (commentsError) {
      console.error('Failed to remove admin badges:', commentsError)
      return response.status(500).json({ error: 'Could not remove admin status.' })
    }

    const { error: adminDeleteError } = await supabaseAdmin
      .from('admins')
      .delete()
      .eq('user_id', userId)
    if (adminDeleteError) {
      console.error('Failed to demote gamble admin:', adminDeleteError)
      return response.status(500).json({ error: 'Could not remove admin status.' })
    }
    return response.json({ deleted: false })
  }

  const { error: commentsError } = await supabaseAdmin.from('comments').delete().eq('user_id', userId)
  const { error: chatError } = await supabaseAdmin.from('chat_messages').delete().eq('user_id', userId)
  const { error: profileError } = await supabaseAdmin.from('profiles').delete().eq('id', userId)
  if (commentsError || chatError || profileError) {
    console.error('Failed to remove account data:', commentsError || chatError || profileError)
    return response.status(500).json({ error: 'Could not remove account data.' })
  }

  const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)
  if (authDeleteError) {
    console.error('Failed to delete Supabase Auth account:', authDeleteError)
    return response.status(500).json({ error: 'Could not delete the Auth account.' })
  }
  return response.json({ deleted: true })
})

app.post('/api/chat', requireUser, perIpChatLimit, perUserChatLimit, dailyChatLimit, async (request, response) => {
  const { message, history = [] } = request.body
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) return response.status(500).json({ error: 'GEMINI_API_KEY is not configured' })
  if (typeof message !== 'string' || !message.trim()) return response.status(400).json({ error: 'message is required' })

  const isCommand = message.trim().startsWith('/')
  const preparedHistory = prepareHistory(history)
  const startedAt = Date.now()

  // Store the user's message regardless of what happens next.
  logMessage(request.user.id, 'user', message)

  // Slash commands (/dance, /theme, etc.) aren't FAQ questions, so skip RAG
  // for them — saves an embedding call and keeps commands snappy.
  const faqContext = isCommand ? '' : await retrieveFaqContext(apiKey, message)
  const systemInstruction = SYSTEM_INSTRUCTION + faqContext

  try {
    let result

    try {
      result = await withRetry(() => runChat({
        apiKey,
        message,
        history: preparedHistory,
        isCommand,
        systemInstruction,
      }))
    } catch (error) {
      // If the model or SDK rejects the thinking setting, retry once without
      // it and stop sending it from now on, so nothing breaks.
      const rejectedThinking = thinkingConfigSupported
        && (error?.status === 400 || /thinking/i.test(error?.message || ''))

      if (!rejectedThinking) throw error

      console.warn('thinkingConfig was rejected by the model/SDK, retrying without it.')
      thinkingConfigSupported = false
      result = await withRetry(() => runChat({
        apiKey,
        message,
        history: preparedHistory,
        isCommand,
        systemInstruction,
      }))
    }

    console.log(`Gemini (${MODEL_NAME}) answered in ${Date.now() - startedAt}ms${faqContext ? ' (with FAQ context)' : ''}`)

    const parts = result.response.candidates?.[0]?.content?.parts ?? []
    const replyText = parts.find((part) => part.text)?.text ?? ''

    if (replyText) logMessage(request.user.id, 'assistant', replyText)

    response.json({
      text: replyText,
      functionCall: parts.find((part) => part.functionCall)?.functionCall ?? null,
    })
  } catch (error) {
    console.error(`Gemini failed after ${Date.now() - startedAt}ms (status ${error?.status ?? 'none'}):`, error)
    response.status(502).json({ error: 'Gemini request failed' })
  }
})

app.listen(port, () => {
  console.log(`Backend running at http://localhost:${port} (model: ${MODEL_NAME})`)
})
