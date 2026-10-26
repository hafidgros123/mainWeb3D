import axios from 'axios'

// The server also trims history, but sending less over the network is free speed.
const MAX_HISTORY_MESSAGES = 10

export async function askGemini(message, history = []) {
  const trimmedHistory = history.slice(-MAX_HISTORY_MESSAGES)
  const response = await axios.post(
    '/api/chat',
    { message, history: trimmedHistory },
    { timeout: 30000 },
  )
  return response.data
}