import { lazy, Suspense, useRef, useState } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import ChatOverlay from './componentsOverlay/chat/ChatOverlay'
import RandomImageOverlay from './componentsOverlay/random/RandomImageOverlay'
import ErrorBoundary from './shared/ErrorBoundary'
import ThemeBackground from './shared/ThemeBackground'
import TurnPlaceholder from './shared/TurnPlaceholder'
import './App.css'

const MainPage = lazy(() => import('./pages/MainPage'))
const GamePage = lazy(() => import('./pages/games/GamePage'))
const ThreeDPage = lazy(() => import('./pages/3d envir/ThreeDPage'))
const ThreeDModelPage = lazy(() => import('./pages/3d envir/ThreeDModelPage'))
const AnimeUpdatesPage = lazy(() => import('./pages/anime/AnimeUpdatesPage'))
const AnimeInfoPage = lazy(() => import('./pages/anime/AnimeInfoPage'))
const ProfilePage = lazy(() => import('./pages/profile/ProfilePage'))
const VideoPage = lazy(() => import('./pages/videoPage/VideoPage'))

function AppContent() {
  const location = useLocation()
  const [theme, setTheme] = useState('crimson')
  const hasRedPageBackground = location.pathname === '/' || location.pathname.startsWith('/games')
  if (location.pathname === '/watch') {
    return (
      <Suspense
        fallback={(
          <TurnPlaceholder
            className="route-loading"
            message="Loading page... you wait or I will make you wait"
          />
        )}
      >
        <VideoPage />
      </Suspense>
    )
  }

  return (
    <div className="app-shell" data-theme={theme}>
      <ThemeBackground theme={theme} showCrimson={hasRedPageBackground} />
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

        <Suspense
          fallback={(
            <TurnPlaceholder
              className="route-loading"
              message="Loading page... you wait or I will make you wait"
            />
          )}
        >
          <Routes>
            <Route path="/" element={<ErrorBoundary><MainPage /></ErrorBoundary>} />
            <Route path="/games/:gameId" element={<ErrorBoundary><GamePage /></ErrorBoundary>} />
            <Route path="/3d" element={<ErrorBoundary><ThreeDPage /></ErrorBoundary>} />
            <Route path="/3d/:modelId" element={<ErrorBoundary><ThreeDModelPage /></ErrorBoundary>} />
            <Route path="/anime" element={<ErrorBoundary><AnimeUpdatesPage /></ErrorBoundary>} />
            <Route path="/anime/:id" element={<ErrorBoundary><AnimeInfoPage /></ErrorBoundary>} />
            <Route path="/profile" element={<ErrorBoundary><ProfilePage /></ErrorBoundary>} />
            <Route path="*" element={<ErrorBoundary><MainPage /></ErrorBoundary>} />
          </Routes>
        </Suspense>
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
        preload="metadata"
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
        Skip
      </button>
    </main>
  )
}

export default App
