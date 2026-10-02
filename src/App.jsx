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
  const hasRedPageBackground = location.pathname === '/' || location.pathname.startsWith('/games')

  return (
    <div className={`app-shell${hasRedPageBackground ? ' app-shell--red-page' : ''}`}>
      <RandomImageOverlay />

      <header className="site-header">
        <Link className="home-link" to="/" aria-label="Return to the main project">
          <span className="home-link-arrow" aria-hidden="true">&#8592;</span>
          <span className="home-link-label">Main project</span>
        </Link>
      </header>

      <Routes>
        <Route path="/" element={<ErrorBoundary><MainPage /></ErrorBoundary>} />
        <Route path="/games" element={<ErrorBoundary><GameListPage /></ErrorBoundary>} />
        <Route path="/games/:gameId" element={<ErrorBoundary><GamePage /></ErrorBoundary>} />
        <Route path="/3d" element={<ErrorBoundary><ThreeDPage /></ErrorBoundary>} />
        <Route path="/anime" element={<ErrorBoundary><AnimeUpdatesPage /></ErrorBoundary>} />
        <Route path="*" element={<ErrorBoundary><MainPage /></ErrorBoundary>} />
      </Routes>

      <ErrorBoundary>
        <ChatOverlay />
      </ErrorBoundary>
    </div>
  )
}

function App() {
  return <AppContent />
}

export default App
