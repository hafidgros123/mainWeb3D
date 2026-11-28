import { supabase } from './supabaseClient'

const MAX_HISTORY_MESSAGES = 10

// In local dev, leave VITE_API_BASE_URL unset if your Vite dev server
// already proxies /api to your local backend (check vite.config.js for a
// `server.proxy` entry — if it's there, this stays empty and nothing
// changes for local testing).
//
// In production, set VITE_API_BASE_URL in Vercel's env vars to your
// deployed Worker's URL, no trailing slash, e.g.:
//   https://ellenbot-backend.<your-subdomain>.workers.dev
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

// What the chat answer can ask the page to do (for example change the theme).
export interface ChatFunctionCall {
  name: string
  args?: Record<string, unknown>
}

export interface ChatAnswer {
  text: string
  functionCall: ChatFunctionCall | null
}

// One line of the answer stream the Worker sends back.
type ChatStreamEvent =
  | { type: 'token'; text: string }
  | { type: 'done'; functionCall?: ChatFunctionCall | null }
  | { type: 'error'; message: string }

// An error that remembers the HTTP status and the body the Worker answered with
// (the chat window reads these to show limit messages).
export class ChatRequestError extends Error {
  status: number
  data: Record<string, unknown>

  constructor(message: string, status: number, data: Record<string, unknown>) {
    super(message)
    this.name = 'ChatRequestError'
    this.status = status
    this.data = data
  }
}

export async function askGemini(
  message: string,
  history: unknown[] = [],
  onToken: (text: string) => void = () => {},
): Promise<ChatAnswer> {
  const trimmedHistory = history.slice(-MAX_HISTORY_MESSAGES)

  const { data: { session }, error } = await supabase.auth.getSession()
  if (error) throw error
  if (!session) throw new Error('AUTH_REQUIRED')

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)

  try {
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ message, history: trimmedHistory }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const data: Record<string, unknown> = await response.json().catch(() => ({}))
      const text = typeof data.error === 'string' ? data.error : 'The chat service is unavailable right now.'
      throw new ChatRequestError(text, response.status, data)
    }
    if (!response.body) throw new Error('The chat response stream is unavailable.')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let text = ''
    let functionCall: ChatFunctionCall | null = null

    const processLine = (line: string) => {
      if (!line) return
      const event = JSON.parse(line) as ChatStreamEvent
      if (event.type === 'token') {
        text += event.text
        onToken(event.text)
      } else if (event.type === 'done') {
        functionCall = event.functionCall ?? null
      } else if (event.type === 'error') {
        throw new Error(event.message)
      }
    }

    try {
      while (true) {
        const { value, done } = await reader.read()
        buffer += decoder.decode(value, { stream: !done })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        lines.forEach(processLine)
        if (done) break
      }
      if (buffer.trim()) processLine(buffer)
    } finally {
      reader.releaseLock()
    }

    return { text, functionCall }
  } finally {
    clearTimeout(timeoutId)
  }
}
