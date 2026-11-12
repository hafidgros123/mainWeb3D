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

export async function askGemini(message, history = [], onToken = () => {}) {
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
      const data = await response.json().catch(() => ({}))
      const requestError = new Error(data.error || 'The chat service is unavailable right now.')
      requestError.status = response.status
      requestError.data = data
      throw requestError
    }
    if (!response.body) throw new Error('The chat response stream is unavailable.')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let text = ''
    let functionCall = null

    const processLine = (line) => {
      if (!line) return
      const event = JSON.parse(line)
      if (event.type === 'token') {
        text += event.text
        onToken(event.text)
      } else if (event.type === 'done') {
        functionCall = event.functionCall
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

