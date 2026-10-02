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

if (!sessionCookieSecret) {
  throw new Error('CHAT_SESSION_SECRET must be configured in production.')
}

if (trustedProxyHops > 0) {
  app.set('trust proxy', trustedProxyHops)
}

const isSlashCommand = (request) => (
  typeof request.body?.message === 'string' && request.body.message.trim().startsWith('/')
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

app.get('/api/health', (request, response) => {
  response.json({ ok: true })
})

app.post('/api/chat', attachAnonymousSession, perIpChatLimit, perSessionChatLimit, dailyChatLimit, async (request, response) => {
  const { message, history = [] } = request.body
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) return response.status(500).json({ error: 'GEMINI_API_KEY is not configured' })
  if (typeof message !== 'string' || !message.trim()) return response.status(400).json({ error: 'message is required' })

  try {
    const ai = new GoogleGenerativeAI(apiKey)
    const isCommand = message.trim().startsWith('/')
    const model = ai.getGenerativeModel({
      model: 'gemini-3.6-flash',
      ...(isCommand ? { tools } : { generationConfig: { maxOutputTokens: 256 } }),
    })
    const chat = model.startChat({ history })
    const result = await chat.sendMessage(isCommand ? message.trim().slice(1) : message)
    const parts = result.response.candidates?.[0]?.content?.parts ?? []

    response.json({
      text: parts.find((part) => part.text)?.text ?? '',
      functionCall: parts.find((part) => part.functionCall)?.functionCall ?? null,
    })
  } catch (error) {
    console.error(error)
    response.status(502).json({ error: 'Gemini request failed' })
  }
})

app.listen(port, () => {
  console.log(`Backend running at http://localhost:${port}`)
})
