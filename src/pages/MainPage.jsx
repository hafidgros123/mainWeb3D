import { Link } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { gameDefinitions } from '../gamesData/gameDefinitions'
import { selectThreeDUnlocked, useProgression } from '../store/progressionStore'

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

function MenuScreen() {
  const faqSectionRef = useRef(null)
  const centerImageInputRef = useRef(null)
  const centerImageUrlRef = useRef(null)
  const [centerImageUrl, setCenterImageUrl] = useState('')
  const completedGames = useProgression((state) => state.completedGames)
  const threeDUnlocked = useProgression(selectThreeDUnlocked)

  useEffect(() => () => {
    if (centerImageUrlRef.current) URL.revokeObjectURL(centerImageUrlRef.current)
  }, [])

  const handleCenterImageChange = (event) => {
    const imageFile = event.currentTarget.files?.[0]
    if (!imageFile || !imageFile.type.startsWith('image/')) return

    const nextImageUrl = URL.createObjectURL(imageFile)
    if (centerImageUrlRef.current) URL.revokeObjectURL(centerImageUrlRef.current)
    centerImageUrlRef.current = nextImageUrl
    setCenterImageUrl(nextImageUrl)
    event.currentTarget.value = ''
  }

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
            {threeDUnlocked ? 'Enter 3D environment' : '3D environment locked'}
          </Link>
          <button
            className={`feature-orbit${centerImageUrl ? ' has-image' : ''}`}
            type="button"
            title={centerImageUrl ? 'Change center image' : 'Choose center image'}
            aria-label={centerImageUrl ? 'Change center image' : 'Choose center image'}
            onClick={() => centerImageInputRef.current?.click()}
          >
            {centerImageUrl && <img className="feature-orbit-image" src={centerImageUrl} alt="" />}
          </button>
          <input
            ref={centerImageInputRef}
            className="feature-image-input"
            type="file"
            accept="image/*"
            aria-label="Choose center image"
            onChange={handleCenterImageChange}
          />
          <Link className="three-d-link anime-updates-link" to="/anime">
            Anime Updates
          </Link>
        </div>

        <div className="project-links">
          <a
            className="project-link"
            href="https://huggingface.co"
            target="_blank"
            rel="noopener noreferrer"
          >
            View my local AI on Hugging Face
          </a>
          <a
            className="project-link project-link--secondary"
            href="https://huggingface.co"
            target="_blank"
            rel="noopener noreferrer"
          >
            View my rag model also on hugging face
          </a>
        </div>

        <details className="about-page">
          <summary>About this page</summary>
          <p>This project brings together three WebGL games, an anime updates area for recent releases, and a 3D experience currently in development.</p>
          <p>Sign-in will be required to comment on anime updates.</p>
          <p>The games use assets from itch.io.</p>
          <p>Note: The 3D page is not fully optimized for mobile devices, so it is recommended to use a desktop or laptop computer for the best experience.</p>
          <p>contact me if you notice any issues , unless your name is Anas (get a better pc bro  <span className="about-emoticon">:p</span> )</p>
          <p></p>
          <p></p>
          <p></p>
          <p></p>
        </details>

        <details className="about-page faq-section" id="faq" ref={faqSectionRef}>
          <summary>FAQ</summary>
          <div className="faq-item">
            <h3>- What is this page for?</h3>
            <p>It is a simple personal space where I keep games, anime updates, and a few playful experiments all in one place.</p>
          </div>
          <div className="faq-item">
            <h3>- how can i acess to the 3d page ??</h3>
            <p>you can either finish any of the games to unlock it permanently as the result will be stored in localstorage (so each device need to do this once) or by typing any variant of /unlock3d</p>
            <h3>- what count as a chat and what count as a command ??</h3>
            <p>basically anything that starts with "/" is a command</p>
            <h3>- how does the 3d page work ?</h3>
            <p>its a top viewed page where you walk arround with your character and select objects to close view them and interact with them</p>
            <h3>- does commands count as messages to the bot ?</h3>
            <p>straigh up no</p>
            <h3>- if i put a command inside my own chat message exemple "hi could you execute /rem " does it count as a command or a message ?</h3>
            <p>it will count as a message and the bot will just ignore the command</p>
            <h3>- what are the commands available ?</h3>
            <p>currently only /unlock3d and /playanimation (or any variant of it) are available</p>
            <h3>- what are the animations available ?</h3>
            <p>idle , dance , wave , jump , sit</p>
            <h3>- how can i trigger an animation ?</h3>
            <p>by typing /playanimation animationName or any variant of it (like /playAnimation or /play-animation)</p>
            <h3>- can i trigger an animation without unlocking the 3d page ?</h3>
            <p>no you need to unlock the 3d page first to be able to trigger animations</p>
            <h3>- can i trigger an animation without finishing a game ?</h3>  
            <p>no, you need to finish a game first to unlock the 3d page and trigger animations</p>
            <h3>- how does it know if i finished a game ?</h3>
            <p>it really is obvious</p>
            <h3>- is it optimized for mobile ?</h3>
            <p>i will see what i can do</p>
            <h3>- do you need a strong pc</h3>
            <p>im trying my best , hold there bud :3</p>
            <h3>-what model was used in the chatbot ?</h3>
            <p>gemini free api was used inside a .env file to not stay in frontend</p>
            <h3>-whats the limit of messages ?</h3>
            <p> 20 daily , 30 from the same ip , this way no need for a subsction but ppl on the same wifi cant use more than 30 messages</p>
            <h3>-favorite game ? (super important)</h3>
            <p>between morrowind and baldurs gate 3</p>
            <h3>- what models are used for the rag model and the Qlora fine-tuning ?</h3>
            <p>one was qwen2.5-coder (renamed silverhand) so it can tell you about how corporates are corrupted and the other was fine-tuned on a dataset of programming questions and answers (qwen3.8 but it runs slower)</p>
            <h3>- what models are you planing next ?</h3>
            <p>one fast maybe a gpt oss 20b or a deepseek 16b v2 model , still figuring it out</p>
            <h3>- was cuda needed ?</h3>
            <p>pretty dumb question but the answer is yea</p>
            <h3>- Why does this site exist ?</h3>
            <p>Honestly, good question. We'll get back to you.</p>
            <h3>Is this page finished?</h3>
            <p>Define "finished."</p>
          </div>
        </details>

        <details className="about-page technical-details" open>
          <summary>Technical Details</summary>
          <p>This project is structured as a small multi-page app that blends a game portal, a chat assistant, and a 3D scene prototype. The main frontend lives in <code>src/</code>, while the backend API lives in the separate <code>serverless-side</code> folder.</p>
          <ul>
            <li><strong>Frontend:</strong> React + Vite power the UI, with route-based screens under <code>src/pages</code> and reusable pieces under <code>src/components</code>.</li>
            <li><strong>State:</strong> Zustand keeps the game progression and 3D scene state in sync across screens. Progress is saved to <code>localStorage</code>, and special unlocks can be temporary for the current session.</li>
            <li><strong>Routing:</strong> React Router controls navigation between the main menu, game pages, the anime section, and the 3D experience.</li>
            <li><strong>3D layer:</strong> Three.js and scene helpers in <code>src/three</code> are intended for the interactive environment, with animation actions driven by the app state.</li>
            <li><strong>Backend:</strong> Express handles chat requests, session rules, and validation before forwarding prompts to Gemini.</li>
            <li><strong>AI chat:</strong> The chat flow uses the Google Generative AI SDK and is configured in <code>src/lib/gemini.js</code>. The app calls the backend endpoint <code>/api/chat</code> instead of exposing the key in the client.</li>
          </ul>
          <p>Game completion is tracked in the progression store, and unlocking the 3D route is tied to both progression and chat commands. The command <code>/unlock3D</code> grants a temporary session unlock, while finishing a game permanently enables access to the 3D page.</p>
          <p>Once unlocked, the app can request animation actions such as <code>idle</code>, <code>dance</code>, <code>wave</code>, <code>jump</code>, and <code>sit</code>. These actions are used to drive the character state in the 3D scene and are coordinated between the frontend state, the chat tool layer, and the animation helpers.</p>
        </details>

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

      </section>
    </main>
  )
}

export default MenuScreen
