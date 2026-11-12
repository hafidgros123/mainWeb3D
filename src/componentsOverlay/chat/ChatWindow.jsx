import { useEffect, useRef, useState } from 'react'
import { askGemini } from '../../lib/gemini'
import { supabase } from '../../lib/supabaseClient'
import { selectThreeDUnlocked, useProgression } from '../../store/progressionStore'
import { useSceneStore } from '../../store/sceneStore'
import { ANIMATION_NAMES } from '../../three/animations'
import './cssfiles/ChatMessages.css'
import './cssfiles/ChatInput.css'
import './cssfiles/ChatFrame.css'

const ellenPortrait = '/assets/hey ellen nom nom.webp'
const userPortrait = '/assets/user.webp'

const GREETING = { message: 'Hey! I am Ellen. What do you need?', sender: 'ellenBot', id: '000000000000' }

// How many past turns to pull back from Supabase when the chat is reopened.
const HISTORY_LIMIT = 50

function ChatWindow({ onClose, onUnlockTheme, userId, onRequireSignIn }) {
  const [messages, setMessages] = useState([GREETING])
  const [text, setText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [clearing, setClearing] = useState(false)
  const messagesContainerRef = useRef(null)
  const threeDUnlocked = useProgression(selectThreeDUnlocked)
  const unlockForSession = useProgression((state) => state.unlockForSession)
  const triggerAnimation = useSceneStore((state) => state.triggerAnimation)

  useEffect(() => {
    const container = messagesContainerRef.current
    if (container) container.scrollTop = container.scrollHeight
  }, [messages])

  // Signed-in users get their saved conversation back; signed-out users
  // (or ones who sign out mid-session) just see the greeting.
  useEffect(() => {
    if (!userId) {
      setMessages([GREETING])
      return
    }

    let cancelled = false
    setHistoryLoading(true)

    supabase
      .from('chat_messages')
      .select('id, role, content, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(HISTORY_LIMIT)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error('Failed to load chat history:', error)
          setMessages([GREETING])
          return
        }
        setMessages(
          data && data.length > 0
            ? data.map((row) => ({
                message: row.content,
                sender: row.role === 'user' ? 'user' : 'ellenBot',
                id: String(row.id),
              }))
            : [GREETING],
        )
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [userId])

  // Permanently deletes this user's saved chat history (needs the delete
  // RLS policy from supabase_sql/02_chat_delete_policy.sql) and resets the
  // window back to the greeting.
  const clearChat = async () => {
    if (!userId || clearing) return
    const confirmed = window.confirm('Delete your chat history with Ellen? This cannot be undone.')
    if (!confirmed) return

    setClearing(true)
    try {
      const { error } = await supabase.from('chat_messages').delete().eq('user_id', userId)
      if (error) {
        console.error('Failed to clear chat history:', error)
        setMessages((current) => [...current, { message: "Couldn't clear the chat. Try again.", sender: 'ellenBot', id: `${crypto.randomUUID()}-clear-error` }])
        return
      }
      setMessages([GREETING])
    } finally {
      setClearing(false)
    }
  }

  const extractCommand = (messageText) => {
    const match = messageText.match(/(?:^|\s)(\/\w+)/i)
    return match ? match[1].toLowerCase() : null
  }

  const sendMessage = async () => {
    if (isSending) return
    if (!userId) {
      onRequireSignIn()
      return
    }

    const messageText = text.trim()
    if (!messageText) return
    const command = extractCommand(messageText)
    const isCommand = Boolean(command)
    const animationName = command ? command.slice(1).toLowerCase() : null
    setMessages((current) => [...current, { message: messageText, sender: 'user', id: crypto.randomUUID() }])
    setText('')

    if (command === '/theme') {
      onUnlockTheme()
      setMessages((current) => [...current, { message: 'Secret theme unlocked. Select it from the theme bar.', sender: 'ellenBot', id: `${crypto.randomUUID()}-theme` }])
      return
    }

    if (command === '/unlock3d') {
      unlockForSession()
      setMessages((current) => [...current, { message: '3D gallery unlocked for this session.', sender: 'ellenBot', id: `${crypto.randomUUID()}-unlock` }])
      return
    }

    const numericGambleCommand = /^\/(\d+)$/.exec(messageText)
    if (numericGambleCommand) {
      const score = Number(numericGambleCommand[1])
      if (score >= 0 && score <= 95) {
        window.dispatchEvent(new CustomEvent('gamble-score', { detail: { score } }))
        setMessages((current) => [...current, {
          message: `Gamble result set to ${score}.`,
          sender: 'ellenBot',
          id: `${crypto.randomUUID()}-gamble`,
        }])
      } else {
        setMessages((current) => [...current, {
          message: 'That gamble result is unavailable. Use a number from 0 to 95.',
          sender: 'ellenBot',
          id: `${crypto.randomUUID()}-gamble-invalid`,
        }])
      }
      return
    }

    if (isCommand && ANIMATION_NAMES.includes(animationName) && threeDUnlocked) {
      triggerAnimation(animationName)
      setMessages((current) => [...current, { message: `Playing ${animationName} animation.`, sender: 'ellenBot', id: `${crypto.randomUUID()}-action` }])
      return
    }

    if (isCommand && !threeDUnlocked) {
      setMessages((current) => [...current, { message: 'Complete any game first, or type /unlock3D.', sender: 'ellenBot', id: `${crypto.randomUUID()}-locked` }])
      return
    }

    const replyId = crypto.randomUUID()
    const history = messages
      .filter((message) => message.id !== GREETING.id)
      .map((message) => ({
        role: message.sender === 'user' ? 'user' : 'model',
        parts: [{ text: message.message }],
      }))
    setMessages((current) => [...current, {
      message: '',
      sender: 'ellenBot',
      id: replyId,
    }])
    setIsSending(true)

    try {
      const response = await askGemini(messageText, history, (token) => {
        setMessages((current) => current.map((message) => (
          message.id === replyId
            ? { ...message, message: message.message + token }
            : message
        )))
      })
      const functionCall = response.functionCall
      if (isCommand && functionCall?.name === 'playAnimation') triggerAnimation(functionCall.args?.animation)
      if (!response.text && isCommand && functionCall) {
        setMessages((current) => current.map((message) => (
          message.id === replyId
            ? { ...message, message: 'I triggered that action for you.' }
            : message
        )))
      }
    } catch (error) {
      const errorMessage = error.message === 'AUTH_REQUIRED' || error.status === 401
        ? 'Your session expired. Please sign in again.'
        : error.status === 429
          ? error.data?.error || 'The chat limit has been reached. Please try again later.'
            : 'The chat service is unavailable right now.'
      setMessages((current) => current.map((message) => (
        message.id === replyId
          ? { ...message, message: errorMessage }
          : message
      )))
      if (error.message === 'AUTH_REQUIRED' || error.status === 401) onRequireSignIn()
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="chat-window" role="dialog" aria-label="Ellen chat">
      <div className="chat-header">
        <button className="chat-back-button" type="button" onClick={onClose} aria-label="Close Ellen chat">&#8592;</button>
        <div><span className="chat-status" aria-hidden="true" /><strong>Chat with Ellen</strong></div>
        {userId && (
          <button
            className="chat-clear-button"
            type="button"
            onClick={clearChat}
            disabled={clearing}
            aria-label="Clear chat history"
            title="Clear chat history"
          >
            &#128465;
          </button>
        )}
      </div>
      <div className="chat-messages" ref={messagesContainerRef}>
        {historyLoading && <div className="chat-history-loading">Loading your conversation...</div>}
        {messages.map((message) => {
          const isBot = message.sender === 'ellenBot'
          return <div key={message.id} className={`chat-message ${isBot ? 'bot' : 'user'}`}>
            {isBot && <img className="message-avatar" src={ellenPortrait} alt="Ellen" />}
            <div className="message-content">
              <div className="message-sender">{isBot ? 'Ellen' : 'You'}</div>
              <div className="message-bubble">
                {isSending && isBot && !message.message
                  ? <img className="message-loading-gif" src="/orbit/ellen-joe-spin-ellen-joe.gif" alt="Ellen Joe spinning while Ellen responds" />
                  : message.message}
              </div>
            </div>
            {!isBot && <img className="message-avatar" src={userPortrait} alt="You" />}
          </div>
        })}
      </div>
      {userId ? (
        <div className="chat-input">
          <input value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && sendMessage()} placeholder="Type a message..." aria-label="Chat message" disabled={isSending} />
          <button type="button" onClick={sendMessage} disabled={isSending}>{isSending ? '...' : 'Send'}</button>
        </div>
      ) : (
        <div className="chat-signin-gate">
          <p>Sign in to chat with Ellen.</p>
          <button type="button" onClick={onRequireSignIn}>Sign In</button>
        </div>
      )}
    </div>
  )
}

export default ChatWindow
