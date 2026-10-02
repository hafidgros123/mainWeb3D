import axios from 'axios'

export async function askGemini(message, history = []) {
  const response = await axios.post('/api/chat', { message, history }, { timeout: 30000 })
  return response.data
}
