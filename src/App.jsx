import { lazy, Suspense, useState } from 'react'
import ellenCharacter from './assets/character_transparent.png'

import './App.css'

const ChatMessages = lazy(() => import('./ChatMessages'))
const ChatInput = lazy(() => import('./ChatInput'))
const initialMessage = {
  message: 'Hey! I am Ellen, whatever you need just say it and i will see if i can do anything about it, ok?',
  sender: 'ellenBot',
  id: '0000000000000'
}

function App() {
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState([initialMessage])

  const openChat = () => setIsChatOpen(true)
  const closeChat = () => setIsChatOpen(false)

  return (
    <>
      <header className="site-header">
        <a className="home-link" href="/" aria-label="Return to the main project">
          <span className="home-link-arrow" aria-hidden="true">&#8592;</span>
          <span className="home-link-label">Main project</span>
        </a>
      </header>

      <main className={`App${isChatOpen ? ' chat-open' : ''}`}>
        <section
          className="main-panel"
          aria-label="Main content"
          onClick={closeChat}
        />

        <aside className="side-panel">
          {!isChatOpen ? (
            <button
              className="chat-launcher"
              type="button"
              onClick={openChat}
              aria-label="Open Ellen chat"
            >
              <img src={ellenCharacter} alt="Ellen" />
              <h2>Chat with Ellen Joe</h2>
            </button>
          ) : (
            <div className="chat-window" role="dialog" aria-label="Ellen chat">
              <div className="chat-header">
                <button
                  className="chat-back-button"
                  type="button"
                  onClick={closeChat}
                  aria-label="Back to the initial view"
                  title="Back to the initial view"
                >
                  <span aria-hidden="true">&#8592;</span>
                </button>
                <div>
                  <span className="chat-status" aria-hidden="true" />
                  <strong>Chat with Ellen Joe</strong>
                </div>
              </div>
              <Suspense fallback={<div className="chat-loading" aria-live="polite">Loading chat...</div>}>
                <ChatMessages chatMessages={chatMessages} />
                <ChatInput chatMessages={chatMessages} setChatMessages={setChatMessages} />
              </Suspense>
            </div>
          )}
        </aside>
      </main>
    </>
  )
}

export default App
