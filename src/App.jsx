import { useRef, useState } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import ChatOverlay from './components/chat/ChatOverlay'
import RandomImageOverlay from './components/random/RandomImageOverlay'
import ErrorBoundary from './components/shared/ErrorBoundary'
import GameListPage from './pages/games/GameListPage'
import GamePage from './pages/games/GamePage'
import AnimeUpdatesPage from './pages/anime/AnimeUpdatesPage'
import MainPage from './pages/MainPage'
import ThreeDPage from './pages/ThreeDPage'
import './App.css'

function AppContent() {
  const location = useLocation()
  const [theme, setTheme] = useState('crimson')
  const hasRedPageBackground = location.pathname === '/' || location.pathname.startsWith('/games')

  return (
    <div className={`app-shell${hasRedPageBackground ? ' app-shell--red-page' : ''}`} data-theme={theme}>
      <RandomImageOverlay />

      <div className="route-transition" key={location.pathname}>
        <header className="site-header">
          {location.pathname !== '/' && (
            <Link className="home-link" to="/" aria-label="Return to the main project">
              <span className="home-link-arrow" aria-hidden="true">&#8592;</span>
              <span className="home-link-label">Main project</span>
            </Link>
          )}
        </header>

        <Routes>
          <Route path="/" element={<ErrorBoundary><MainPage /></ErrorBoundary>} />
          <Route path="/games" element={<ErrorBoundary><GameListPage /></ErrorBoundary>} />
          <Route path="/games/:gameId" element={<ErrorBoundary><GamePage /></ErrorBoundary>} />
          <Route path="/3d" element={<ErrorBoundary><ThreeDPage /></ErrorBoundary>} />
          <Route path="/anime" element={<ErrorBoundary><AnimeUpdatesPage /></ErrorBoundary>} />
          <Route path="*" element={<ErrorBoundary><MainPage /></ErrorBoundary>} />
        </Routes>
      </div>

      <ErrorBoundary>
        <ChatOverlay theme={theme} onThemeChange={setTheme} />
      </ErrorBoundary>
    </div>
  )
}

function App() {
  const [introComplete, setIntroComplete] = useState(false)
  const [introStarted, setIntroStarted] = useState(false)
  const videoRef = useRef(null)

  if (introComplete) return <AppContent />

  return (
    <main className="intro-screen">
      <video
        ref={videoRef}
        playsInline
        preload="auto"
        aria-label="Intro video"
        onPlay={() => setIntroStarted(true)}
        onEnded={() => setIntroComplete(true)}
      >
        <source src="/skyrim.mp4" type="video/mp4" />
      </video>
      {!introStarted && (
        <button className="intro-play" onClick={() => videoRef.current?.play()} aria-label="Play intro with sound">
          <span className="intro-play-icon" aria-hidden="true" />
          <span>Play with sound</span>
        </button>
      )}
      <button className="intro-skip" onClick={() => setIntroComplete(true)}>
        Skip intro
      </button>
    </main>
  )
}

export default App
