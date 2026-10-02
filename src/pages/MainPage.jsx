import { Link } from 'react-router-dom'
import { useRef } from 'react'
import { gameDefinitions } from '../gamesData/gameDefinitions'
import { selectThreeDUnlocked, useProgression } from '../store/progressionStore'

function MenuScreen() {
  const faqSectionRef = useRef(null)
  const completedGames = useProgression((state) => state.completedGames)
  const threeDUnlocked = useProgression(selectThreeDUnlocked)

  return (
    <main className="AppMainMenu">
      <section className="main-panel main-page-content" aria-labelledby="main-page-title">
        <h1 id="main-page-title">NomNom....?? Main</h1>
        <p className="page-intro">
          Welcome to my personal web page! Pick any game to unlock the 3D environment, or catch up on anime news and new episode releases.{' '}
          <a href="#faq" onClick={() => { faqSectionRef.current.open = true }}>
            Read the FAQ
          </a>
        </p>
        <div className="game-grid">
          {gameDefinitions.map((game) => {
            const isComplete = completedGames.includes(game.id)

            return (
              <Link className="game-card" to={`/games/${game.id}`} key={game.id}>
                <span className="game-number">{game.number}</span>
                <span>
                  <strong>{game.title}</strong>
                  <small>{isComplete ? 'Completed' : 'Available'}</small>
                </span>
              </Link>
            )
          })}
        </div>

        <div className="main-feature-links">
          <Link
            className={`three-d-link${threeDUnlocked ? '' : ' locked'}`}
            to="/3d"
            aria-disabled={!threeDUnlocked}
            onClick={(event) => {
              if (!threeDUnlocked) event.preventDefault()
            }}
          >
            {threeDUnlocked ? 'Enter 3D experience' : '3D experience locked'}
          </Link>
          <Link className="three-d-link anime-updates-link" to="/anime">
            Anime Updates
          </Link>
        </div>

        <details className="about-page">
          <summary>About this page</summary>
          <p>This project brings together three WebGL games, an anime updates area for recent releases, and a 3D experience currently in development.</p>
          <p>Sign-in will be required to comment on anime updates.</p>
          <p>The games use assets from itch.io.</p>
          <p>Note: The 3D page is not fully optimized for mobile devices, so it is recommended to use a desktop or laptop computer for the best experience.</p>
          <p>contact me if you notice any issues , unless your name is Anas (get a better pc bro  <span className="about-emoticon">:p</span> )</p>
        </details>

        <details className="about-page faq-section" id="faq" ref={faqSectionRef}>
          <summary>FAQ</summary>
          <div className="faq-item">
            <h3>What is this page for?</h3>
            <p>It is a simple personal space where I keep games, anime updates, and a few playful experiments all in one place.</p>
          </div>
          <div className="faq-item">
            <h3>how can i acess to the 3d page</h3>
            <p>you can either </p>
          </div>
        </details>

        <details className="about-page technical-details">
          <summary>Technical Details</summary>
          <p>The app is split by responsibility: <code>src/pages</code> contains route-level screens, <code>src/components</code> contains reusable interface pieces such as chat, <code>src/store</code> holds shared state, and <code>src/lib</code> contains service clients. The separate <code>serverless-side</code> folder contains the Express API. React Router connects the page routes.</p>
          <p>Three.js is the planned library for real-time 3D rendering. The 3D route currently shows a placeholder; its canvas, scene, and character animation playback are not connected yet.</p>
          <p>Zustand manages game progression and pending scene-animation actions. Its persist middleware saves completed games to localStorage; the temporary session unlock is not persisted.</p>
          <p>Axios sends chat messages and conversation history to <code>/api/chat</code>. Express validates the request and calls Gemini through Google's Generative AI library.</p>
          <p>Chat command: <code>/unlock3D</code> temporarily unlocks 3D interactions for the current session. Completing any game unlocks the 3D page persistently. Once unlocked, slash commands can request the predefined <code>idle</code>, <code>dance</code>, <code>wave</code>, <code>jump</code>, or <code>sit</code> animation actions.</p>
        </details>
      </section>
    </main>
  )
}

export default MenuScreen
