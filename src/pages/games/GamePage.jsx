import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { gameDefinitions } from '../../gamesData/gameDefinitions'
import { useProgression } from '../../store/progressionStore'
import GameComments from './GameComments'
import './gamepage.css'



const contactLinks = [
  { label: 'Email', icon: 'email', value: 'your@email.com', href: 'mailto:your@email.com' },
  {
    label: 'Discord',
    icon: 'discord',
    value: 'your-discord-user-id',
    href: 'https://discord.com/users/your-discord-user-id',
    external: true,
  },
  {
    label: 'WhatsApp',
    icon: 'whatsapp',
    value: 'your-phone-number',
    href: 'https://wa.me/your-phone-number',
    external: true,
  },
  {
    label: 'GitHub',
    icon: 'github',
    value: 'your-username',
    href: 'https://github.com/your-username',
    external: true,
  },
]

function ContactIcon({ type }) {
  return (
    <svg
      className="contact-link-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {type === 'email' && <>
        <rect x="3" y="5" width="18" height="14" rx="1" />
        <path d="m4 7 8 6 8-6" />
      </>}
      {type === 'discord' && <>
        <path d="M6.5 8.5c3.5-2 7.5-2 11 0l1.5 8c-2 1.5-4 2-7 2s-5-.5-7-2l1.5-8Z" />
        <path d="M9 13h.01M15 13h.01M8 17l1-2m7 2-1-2" />
      </>}
      {type === 'whatsapp' && <>
        <path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4A8 8 0 1 1 20 11.5Z" />
        <path d="M9 8.5c.4 2.8 2.2 4.6 5 5l1-1.2 2 .8c-.2 1.5-1.2 2.2-2.5 2-3.5-.6-6-3.1-6.5-6.5-.2-1.3.5-2.3 2-2.5l.8 2L9 8.5Z" />
      </>}
      {type === 'github' && <>
        <path d="m8 8-4 4 4 4m8-8 4 4-4 4m-3-10-2 12" />
      </>}
    </svg>
  )
}

function GamePage() {
  const { gameId } = useParams()
  const game = gameDefinitions.find((definition) => definition.id === gameId)
  const currentId = game?.id

  const frameRef = useRef(null)
  // 'checking' -> looking for the Unity build, 'ready' -> found, 'missing' -> not exported yet
  const [build, setBuild] = useState('checking')

  const completeGame = useProgression((state) => state.completeGame)
  const isCompleted = useProgression((state) => state.completedGames.includes(gameId))

  // Look for the Unity WebGL build in public/unity/<game-id>/index.html.
  // (In dev, a missing file returns the app's own page, so we check for Unity's loader code.)
  useEffect(() => {
    if (!currentId) return undefined
    let cancelled = false
    setBuild('checking')

    fetch(`/unity/${currentId}/index.html`)
      .then((response) => (response.ok ? response.text() : ''))
      .then((text) => {
        if (!cancelled) setBuild(text.includes('createUnityInstance') ? 'ready' : 'missing')
      })
      .catch(() => {
        if (!cancelled) setBuild('missing')
      })

    return () => {
      cancelled = true
    }
  }, [currentId])

  // The Unity game tells the page when the player finishes it:
  // window.parent.postMessage({ type: 'game-complete' }, window.location.origin)
  useEffect(() => {
    if (!currentId) return undefined

    function handleMessage(event) {
      if (event.origin !== window.location.origin) return
      if (event.source !== frameRef.current?.contentWindow) return
      if (event.data?.type === 'game-complete') completeGame(currentId)
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [currentId, completeGame])

  if (!game) {
    return <p>Game not found.</p>
  }

  return (
    <main className="game-page">
      <p className="eyebrow">
        Game {game.number}
        {isCompleted && <span className="game-complete-badge">Completed</span>}
      </p>
      <h1>{game.title}</h1>

      {build === 'ready' ? (
        <section className="game-frame" aria-label={`${game.title} game`}>
          <iframe
            ref={frameRef}
            title={game.title}
            src={`/unity/${game.id}/index.html`}
            allow="fullscreen"
            allowFullScreen
          />
        </section>
      ) : (
        <section className="game-placeholder" aria-label={`${game.title} placeholder`}>
          <p>{build === 'checking' ? 'Loading game...' : 'This game is not ready yet.'}</p>
          <small>Put the WebGL build in public/unity/{game.id}/.</small>
        </section>
      )}

      <GameComments gameId={game.id} />



        <section className="contact-section" aria-labelledby="contact-title">
          <h2 id="contact-title">Contact</h2>
          <div className="contact-links">
            {contactLinks.map(({ label, icon }) => (
              <div className="contact-link" key={label} aria-hidden="true">
                <span className="contact-link-label">
                  <ContactIcon type={icon} />
                  {label}
                </span>
                <small></small>
              </div>
            ))}
          </div>
        </section>
    </main>


  )
}

export default GamePage