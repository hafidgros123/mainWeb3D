import express from 'express'
import { rateLimit } from 'express-rate-limit'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { ANIMATION_NAMES } from '../src/three/animations.js'

const app = express()
const port = process.env.PORT || 3001
const trustedProxyHops = Number.parseInt(process.env.TRUST_PROXY_HOPS || '0', 10)
const sessionCookieName = 'chat_session'
const sessionCookieSecret = process.env.CHAT_SESSION_SECRET
  || (process.env.NODE_ENV === 'production' ? null : randomBytes(32).toString('hex'))

// --- Speed settings -------------------------------------------------------
// Change the model without touching code: GEMINI_MODEL=<model id> in your env.
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-3.6-flash'
// Only the last N messages are sent to Gemini. Less input = faster reply.
const MAX_HISTORY_MESSAGES = 10
// Give up on Gemini before the browser's 30s axios timeout does.
const GEMINI_TIMEOUT_MS = 25000
// Tries to turn "thinking" off. If the model/SDK rejects it, the server
// falls back automatically and stops trying (see the chat route).
let thinkingConfigSupported = true

const SYSTEM_INSTRUCTION = `You are Ellen, a goth girl in her early 20s.
You still kinda try to help the user, but you are not very enthusiastic about it.
You are a bit lazy, but you still get things done eventually.
You never use exclamation marks or sound excited.
You often leave comments on the user's questions, like "really?" or "wow, that's a question" or "ok, sure, whatever".
You always answer.`

if (!sessionCookieSecret) {
  throw new Error('CHAT_SESSION_SECRET must be configured in production.')
}

if (trustedProxyHops > 0) {
  app.set('trust proxy', trustedProxyHops)
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

function signSessionId(sessionId) {
  return createHmac('sha256', sessionCookieSecret).update(sessionId).digest('base64url')
}

function verifySessionId(cookieValue) {
  if (!cookieValue) return null

  const separator = cookieValue.lastIndexOf('.')
  if (separator < 0) return null

  const sessionId = cookieValue.slice(0, separator)
  const suppliedSignature = Buffer.from(cookieValue.slice(separator + 1), 'base64url')
  if (!/^[a-f0-9]{48}$/.test(sessionId)) return null

  const expectedSignature = Buffer.from(signSessionId(sessionId), 'base64url')
  if (suppliedSignature.length !== expectedSignature.length) return null
  return timingSafeEqual(suppliedSignature, expectedSignature) ? sessionId : null
}

function attachAnonymousSession(request, response, next) {
  const cookiePrefix = `${sessionCookieName}=`
  const existingCookie = request.headers.cookie
    ?.split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(cookiePrefix))
  const cookieValue = existingCookie?.slice(cookiePrefix.length)
  let sessionId = verifySessionId(cookieValue)

  if (!sessionId) {
    sessionId = randomBytes(24).toString('hex')
    const signature = signSessionId(sessionId)
    const secureAttribute = process.env.NODE_ENV === 'production' ? '; Secure' : ''
    response.append(
      'Set-Cookie',
      `${sessionCookieName}=${sessionId}.${signature}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${secureAttribute}`,
    )
  }

  request.chatSessionId = sessionId
  next()
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

const perSessionChatLimit = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: 20,
  keyGenerator: (request) => `chat-session:${request.chatSessionId}`,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isSlashCommand,
  handler: (_request, response) => response.status(429).json({
    error: 'This browser has reached its daily chat limit. Please try again later.',
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
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
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

function buildGenerationConfig(isCommand, withThinkingOff) {
  const config = {}
  if (!isCommand) config.maxOutputTokens = 256
  if (withThinkingOff) config.thinkingConfig = { thinkingBudget: 0 }
  return config
}

async function runChat({ apiKey, message, history, isCommand, withThinkingOff }) {
  const model = getClient(apiKey).getGenerativeModel(
    {
      model: MODEL_NAME,
      systemInstruction: SYSTEM_INSTRUCTION,
      generationConfig: buildGenerationConfig(isCommand, withThinkingOff),
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

app.get('/api/health', (request, response) => {
  response.json({ ok: true })
})

app.post('/api/chat', attachAnonymousSession, perIpChatLimit, perSessionChatLimit, dailyChatLimit, async (request, response) => {
  const { message, history = [] } = request.body
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) return response.status(500).json({ error: 'GEMINI_API_KEY is not configured' })
  if (typeof message !== 'string' || !message.trim()) return response.status(400).json({ error: 'message is required' })

  const isCommand = message.trim().startsWith('/')
  const preparedHistory = prepareHistory(history)
  const startedAt = Date.now()

  try {
    let result

    try {
      result = await withRetry(() => runChat({
        apiKey,
        message,
        history: preparedHistory,
        isCommand,
        withThinkingOff: thinkingConfigSupported,
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
        withThinkingOff: false,
      }))
    }

    console.log(`Gemini (${MODEL_NAME}) answered in ${Date.now() - startedAt}ms`)

    const parts = result.response.candidates?.[0]?.content?.parts ?? []

    response.json({
      text: parts.find((part) => part.text)?.text ?? '',
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