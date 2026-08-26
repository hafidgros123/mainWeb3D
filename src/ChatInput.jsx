import { useState } from 'react'
import './ChatInput.css'

function ChatInput({ chatMessages, setChatMessages }) {
  const [text, setText] = useState('')

  const handleSend = () => {
    if (!text.trim()) return

    const newMessage = {
      message: text,
      sender: 'user',
      id: Date.now().toString()
    }

    setChatMessages([...chatMessages, newMessage])
    setText('')

    // fake bot reply so it feels alive — swap this out for a real API call later
    setTimeout(() => {
      setChatMessages((prev) => [
        ...prev,
        {
          message: "Got it! I'm still learning, but I'm on it.",
          sender: 'ellenBot',
          id: (Date.now() + 1).toString()
        }
      ])
    }, 800)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSend()
  }

  return (
    <div className="chat-input">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message..."
      />
      <button onClick={handleSend}>Send</button>
    </div>
  )
}

export default ChatInput