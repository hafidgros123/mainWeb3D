import { useState } from 'react'
import ChatBubbleButton from './ChatBubbleButton'
import ChatWindow from './ChatWindow'

function ChatOverlay() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <aside className={`chat-overlay${isOpen ? ' chat-open' : ''}`}>
      {isOpen ? <ChatWindow onClose={() => setIsOpen(false)} /> : <ChatBubbleButton onOpen={() => setIsOpen(true)} />}
    </aside>
  )
}

export default ChatOverlay
