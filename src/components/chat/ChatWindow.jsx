import { useState } from 'react'
import { askGemini } from '../../lib/gemini'
import { selectThreeDUnlocked, useProgression } from '../../store/progressionStore'
import { useSceneStore } from '../../store/sceneStore'
import './cssfiles/ChatMessages.css'
import './cssfiles/ChatInput.css'
import ellenPortrait from '../../assets/hey ellen nom nom.png'
import userPortrait from '../../assets/user.jpg'

function ChatWindow({ onClose }) {
  const [messages, setMessages] = useState([{ message: 'Hey! I am Ellen. What do you need?', sender: 'ellenBot', id: '000000000000' }])
  const [text, setText] = useState('')
  const threeDUnlocked = useProgression(selectThreeDUnlocked)
  const unlockForSession = useProgression((state) => state.unlockForSession)
  const triggerAnimation = useSceneStore((state) => state.triggerAnimation)

  const sendMessage = async () => {
    const messageText = text.trim()
    if (!messageText) return
    const isCommand = messageText.startsWith('/')
    const normalizedCommand = messageText.toLowerCase()
    setMessages((current) => [...current, { message: messageText, sender: 'user', id: crypto.randomUUID() }])
    setText('')

    if (normalizedCommand === '/unlock3d') {
      unlockForSession()
      setMessages((current) => [...current, { message: '3D interactions unlocked for this session.', sender: 'ellenBot', id: `${crypto.randomUUID()}-unlock` }])
      return
    }

    if (isCommand && !threeDUnlocked) {
      setMessages((current) => [...current, { message: 'Complete any game first, or type /unlock3D.', sender: 'ellenBot', id: `${crypto.randomUUID()}-locked` }])
      return
    }

    try {
      const response = await askGemini(messageText)
      const functionCall = response.functionCall
      if (isCommand && functionCall?.name === 'playAnimation') triggerAnimation(functionCall.args?.animation)
      if (response.text) setMessages((current) => [...current, { message: response.text, sender: 'ellenBot', id: `${crypto.randomUUID()}-reply` }])
      if (!response.text && isCommand && functionCall) setMessages((current) => [...current, { message: 'I triggered that action for you.', sender: 'ellenBot', id: `${Date.now()}-action` }])
    } catch (error) {
      const errorMessage = error.response?.status === 429
        ? error.response.data?.error || 'The chat limit has been reached. Please try again later.'
        : 'The chat service is unavailable right now.'
      setMessages((current) => [...current, { message: errorMessage, sender: 'ellenBot', id: `${crypto.randomUUID()}-error` }])
    }
  }

  return (
    <div className="chat-window" role="dialog" aria-label="Ellen chat">
      <div className="chat-header">
        <button className="chat-back-button" type="button" onClick={onClose} aria-label="Close Ellen chat">&#8592;</button>
        <div><span className="chat-status" aria-hidden="true" /><strong>Chat with Ellen</strong></div>
      </div>
      <div className="chat-messages">
        {messages.map((message) => {
          const isBot = message.sender === 'ellenBot'
          return <div key={message.id} className={`chat-message ${isBot ? 'bot' : 'user'}`}>
            {isBot && <img className="message-avatar" src={ellenPortrait} alt="Ellen" />}
            <div className="message-content"><div className="message-sender">{isBot ? 'Ellen' : 'You'}</div><div className="message-bubble">{message.message}</div></div>
            {!isBot && <img className="message-avatar" src={userPortrait} alt="You" />}
          </div>
        })}
      </div>
      <div className="chat-input">
        <input value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && sendMessage()} placeholder="Type a message..." aria-label="Chat message" />
        <button type="button" onClick={sendMessage}>Send</button>
      </div>
    </div>
  )
}

export default ChatWindow
