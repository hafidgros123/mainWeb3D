import axios from 'axios'
import { supabase } from './supabaseClient'

// The server also trims history, but sending less over the network is free speed.
const MAX_HISTORY_MESSAGES = 10

export async function askGemini(message, history = []) {
  const trimmedHistory = history.slice(-MAX_HISTORY_MESSAGES)

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    // Caught by ChatWindow, which prompts the user to sign in instead of
    // showing a raw network error.
    throw new Error('AUTH_REQUIRED')
  }

  const response = await axios.post(
    '/api/chat',
    { message, history: trimmedHistory },
    {
      timeout: 30000,
      headers: { Authorization: `Bearer ${session.access_token}` },
    },
  )
  return response.data
}
