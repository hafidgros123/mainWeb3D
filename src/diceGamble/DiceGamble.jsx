import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadFace, newThrowUrl, preloadFaces, preloadThrow, releaseThrowUrl } from '../lib/DiceImages'
import { rollDiceEven } from '../lib/rollDice'
import { findOutcome, pickVideo } from './outcomes'
import SingleDie from './singleDie'
import './DiceGamble.css'

const DICE_COUNT = 5
const THROW_MS = 800         // how long the throw animation plays (milliseconds)
const STARTING_ROLLS = 9999  // "die left" for now, you can change this later
const RESULT_PAUSE_MS = 600  // how long the total stays visible before the video page opens (0 = instantly)

const COOLDOWN_ROLLS = 10    // after something comes up, it can't come up again for this many rolls
const COOLDOWN_MODE = 'total' // 'total'   = block the exact number (e.g. 33)
                              // 'outcome' = block the whole range/video (e.g. everything in 32-38)
const STORAGE_KEY = 'diceGambleCooldown'

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const sumOf = (list) => list.reduce((sum, value) => sum + value, 0)

// ---- cooldown memory (saved in the browser so it survives page changes and refreshes) ----
// shape: { rollCount: 42, last: { "33": 40, "32-38": 40 } }  -> "key last came up on roll number N"
function loadCooldown() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (saved && typeof saved.rollCount === 'number' && saved.last) return saved
  } catch { /* ignore broken or blocked storage */ }
  return { rollCount: 0, last: {} }
}

function saveCooldown(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch { /* ignore */ }
}

// the key we put on cooldown for a given total
function cooldownKey(total) {
  if (COOLDOWN_MODE === 'outcome') {
    const outcome = findOutcome(total)
    if (outcome) return `${outcome.min}-${outcome.max}`
  }
  return String(total)
}

// is this total blocked on the roll number "rollNumber"?
function isBlocked(total, state, rollNumber) {
  const lastSeen = state.last[cooldownKey(total)]
  return lastSeen !== undefined && rollNumber - lastSeen <= COOLDOWN_ROLLS
}

function DiceGamble() {
  const [isOpen, setIsOpen] = useState(false)
  const [values, setValues] = useState(() => Array(DICE_COUNT).fill(0))
  const [isRolling, setIsRolling] = useState(false)
  const [throwSrc, setThrowSrc] = useState('')
  const [rollsLeft, setRollsLeft] = useState(STARTING_ROLLS)
  const navigate = useNavigate()
  const mountedRef = useRef(false)

  // load every die picture and the throw animation once, as soon as the page opens
  useEffect(() => {
    mountedRef.current = true
    preloadFaces()
    preloadThrow()
    return () => { mountedRef.current = false }
  }, [])

  const total = sumOf(values)
  const canRoll = !isRolling && rollsLeft > 0

  const handleRoll = async () => {
    if (!canRoll) return

    // TEST ONLY: open the site with ?roll=27 to force a total of 27. It does nothing in the real (built) site.
    const param = new URLSearchParams(window.location.search).get('roll')
    const forced = import.meta.env.DEV && param !== null && Number.isFinite(Number(param)) ? Number(param) : undefined

    // roll, and quietly re-roll while the total is still on cooldown (not done for the ?roll= test hook)
    const cooldown = loadCooldown()
    const rollNumber = cooldown.rollCount + 1
    let result = rollDiceEven(DICE_COUNT, forced) // the result is decided now, the animation only reveals it
    if (forced === undefined) {
      for (let attempt = 0; attempt < 200 && isBlocked(sumOf(result), cooldown, rollNumber); attempt++) {
        result = rollDiceEven(DICE_COUNT)
      }
    }
    const rolledTotal = sumOf(result)

    // remember it now (before any waiting) so it is saved even if the page changes
    cooldown.rollCount = rollNumber
    cooldown.last[cooldownKey(rolledTotal)] = rollNumber
    saveCooldown(cooldown)

    const animationUrl = newThrowUrl() // a fresh URL, so the animation always starts from the beginning
    setThrowSrc(animationUrl)
    setIsRolling(true)
    setRollsLeft((left) => left - 1)

    // show the result only after BOTH the animation time has passed AND the new faces are loaded
    await Promise.all([wait(THROW_MS), ...result.map(loadFace)])

    releaseThrowUrl(animationUrl)
    if (!mountedRef.current) return
    setValues(result)
    setIsRolling(false)

    // does this total have an outcome? if yes, go to the media page (video, image or gif)
    const outcome = findOutcome(rolledTotal)
    if (outcome) {
      await wait(RESULT_PAUSE_MS)
      if (!mountedRef.current) return
      const forcedFlag = outcome.skippable === false ? '&forced=1' : ''
      const mediaType = outcome.images ? 'image' : 'video'
      navigate(`/watch?src=${encodeURIComponent(pickVideo(outcome))}&type=${mediaType}${forcedFlag}`)
    }
  }

  return (
    <section className="dice-gamble">
      <button
        className="dice-toggle"
        type="button"
        aria-expanded={isOpen}
        aria-controls="dice-panel"
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="dice-diamond" aria-hidden="true" />
        <span>Test your luck</span>
        <span className="dice-diamond" aria-hidden="true" />
      </button>

      <div id="dice-panel" className={`dice-panel${isOpen ? ' is-open' : ''}`}>
        <div className="dice-panel-inner">
          <div className="dice-card">
            <div className="dice-stage">
              {values.map((value, index) => (
                <SingleDie
                  key={index}
                  className={`die-slot die-slot-${index + 1}`}
                  value={value}
                  rolling={isRolling}
                  throwSrc={throwSrc}
                />
              ))}
              <div className="dice-box dice-total" aria-live="polite">
                <span className="dice-box-label">Total :</span>
                <strong>{isRolling ? '...' : total}</strong>
              </div>
            </div>

            <div className="dice-box dice-left">
              <span className="dice-box-label">Die left :</span>
              <strong>{rollsLeft}</strong>
            </div>

            <button className="dice-roll" type="button" disabled={!canRoll} onClick={handleRoll}>
              {isRolling ? 'Rolling...' : 'Roll'}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

export default DiceGamble