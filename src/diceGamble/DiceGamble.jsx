import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadFace, newThrowUrl, preloadFaces, preloadThrow, releaseThrowUrl } from '../lib/DiceImages'
import { rollDiceEven } from '../lib/rollDice'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../lib/supabaseClient'
import GambleQuiz from '../gamble/GambleQuiz'
import { findOutcome, pickVideo } from './outcomes'
import SingleDie from './singleDie'
import Hanger from '../shared/Hanger'
import './DiceGamble.css'

const DICE_COUNT = 5
const THROW_MS = 800         // how long the throw animation plays (milliseconds)
const DAILY_ROLLS = 10       // rolls per day for everybody except admins (admins are unlimited). The day changes at midnight UTC.
const GUEST_ROLLS_KEY = 'diceGambleDailyRolls' // signed-out visitors: counted in this browser (signed-in people are counted by the database)
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

// ---- daily roll counter for signed-out visitors (signed-in people are counted by Supabase: consume_dice_roll) ----
const todayUtc = () => new Date().toISOString().slice(0, 10)

function loadGuestUsed() {
  try {
    const saved = JSON.parse(localStorage.getItem(GUEST_ROLLS_KEY))
    if (saved && saved.day === todayUtc() && Number.isInteger(saved.used)) return saved.used
  } catch { /* ignore broken or blocked storage */ }
  return 0
}

function takeGuestRoll() {
  const used = loadGuestUsed()
  if (used >= DAILY_ROLLS) return { allowed: false, left: 0 }
  try { localStorage.setItem(GUEST_ROLLS_KEY, JSON.stringify({ day: todayUtc(), used: used + 1 })) } catch { /* ignore */ }
  return { allowed: true, left: DAILY_ROLLS - used - 1 }
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
  const [rollsLeft, setRollsLeft] = useState(null) // null = still loading, -1 = unlimited (admin)
  const [checking, setChecking] = useState(false)
  const { authReady, user, isAdmin } = useAuth()
  const userId = user?.id ?? null
  const [quizOpen, setQuizOpen] = useState(false)
  const [accountNotice, setAccountNotice] = useState('')
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
  const unlimited = rollsLeft === -1
  const canRoll = !isRolling && !checking && rollsLeft !== null && (unlimited || rollsLeft > 0)

  // how many rolls are left today: admins unlimited, signed-in people from the database, visitors from this browser
  useEffect(() => {
    if (!authReady) return undefined
    if (!userId) {
      setRollsLeft(DAILY_ROLLS - loadGuestUsed())
      return undefined
    }
    if (isAdmin === null) {
      setRollsLeft(null)
      return undefined
    }
    if (isAdmin) {
      setRollsLeft(-1)
      return undefined
    }
    let cancelled = false
    supabase.rpc('dice_rolls_left').then(({ data, error }) => {
      if (cancelled) return
      if (error) {
        console.error('Could not read the daily rolls:', error)
        setRollsLeft(0)
        return
      }
      setRollsLeft(data)
    })
    return () => { cancelled = true }
  }, [authReady, userId, isAdmin])

  // uses up one of today's rolls; false = none left today
  const takeRoll = async () => {
    if (isAdmin === true) return true // admins: unlimited
    if (userId) {
      const { data, error } = await supabase.rpc('consume_dice_roll')
      const row = Array.isArray(data) ? data[0] : data
      if (error || !row) {
        console.error('Could not count the roll:', error)
        setAccountNotice('Could not count your roll. Please try again in a moment.')
        return false
      }
      setRollsLeft(row.rolls_left)
      if (!row.allowed) setAccountNotice('No rolls left today. They come back tomorrow.')
      return row.allowed === true
    }
    const guest = takeGuestRoll()
    setRollsLeft(guest.left)
    if (!guest.allowed) setAccountNotice('No rolls left today. They come back tomorrow.')
    return guest.allowed
  }

  const processScore = useCallback(async (score) => {
    if (!Number.isInteger(score) || score < 0 || score > 95) return

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setAccountNotice('Sign in before using a gamble result that can affect your account.')
      return
    }

    setAccountNotice('')
    if (score < 6) {
      setQuizOpen(true)
      return
    }

    if (score === 95) {
      const { error } = await supabase.rpc('grant_gamble_admin')
      if (error) {
        console.error('Failed to grant gamble admin status:', error)
        setAccountNotice('The admin reward could not be applied. Run the gamble SQL migration first.')
        return
      }
      setAccountNotice('You reached 95. youre now a gambling master and have been granted admin status. delete comments and you choose youre own title')
    }
  }, [])

  useEffect(() => {
    const handleCommandScore = (event) => {
      const score = event.detail?.score
      void processScore(score)

      if (!Number.isInteger(score) || score < 6 || score > 95) return
      const outcome = findOutcome(score)
      if (!outcome) {
        setAccountNotice(`Gamble result ${score} has no configured outcome.`)
        return
      }

      const forcedFlag = outcome.skippable === false ? '&forced=1' : ''
      const mediaType = outcome.images ? 'image' : 'video'
      navigate(`/watch?src=${encodeURIComponent(pickVideo(outcome))}&type=${mediaType}${forcedFlag}`)
    }
    window.addEventListener('gamble-score', handleCommandScore)
    return () => window.removeEventListener('gamble-score', handleCommandScore)
  }, [navigate, processScore])

  const handleRoll = async () => {
    if (!canRoll) return

    setChecking(true)
    setAccountNotice('')
    const allowed = await takeRoll()
    if (!mountedRef.current) return
    setChecking(false)
    if (!allowed) return

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

    // show the result only after BOTH the animation time has passed AND the new faces are loaded
    await Promise.all([wait(THROW_MS), ...result.map(loadFace)])

    releaseThrowUrl(animationUrl)
    if (!mountedRef.current) return
    setValues(result)
    setIsRolling(false)
    void processScore(rolledTotal)

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
          <div className="dice-card-wrap">
            <Hanger className="hanger--corner" src="/hang/el.png" />
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
              <strong>{rollsLeft === null ? '...' : unlimited ? '\u221e' : rollsLeft}</strong>
            </div>
            {accountNotice && <p className="dice-account-notice" role="status">{accountNotice}</p>}

            <button className="dice-roll" type="button" disabled={!canRoll} onClick={handleRoll}>
              {isRolling ? 'Rolling...' : 'Roll'}
            </button>
          </div>
          </div>
        </div>
      </div>
      {quizOpen && <GambleQuiz onClose={() => setQuizOpen(false)} />}
    </section>
  )
}

export default DiceGamble