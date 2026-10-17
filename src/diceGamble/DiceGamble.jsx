import { useEffect, useRef, useState } from 'react'
import { loadFace, newThrowUrl, preloadFaces, preloadThrow, releaseThrowUrl } from '../lib/DiceImages.js'
import { rollDiceEven } from '../lib/rollDice'
import SingleDie from './singleDie'
import './DiceGamble.css'

const DICE_COUNT = 5
const THROW_MS = 800        // how long the throw animation plays (milliseconds)
const STARTING_ROLLS = 9999 // "die left" for now, you can change this later

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function DiceGamble() {
  const [isOpen, setIsOpen] = useState(false)
  const [values, setValues] = useState(() => Array(DICE_COUNT).fill(0))
  const [isRolling, setIsRolling] = useState(false)
  const [throwSrc, setThrowSrc] = useState('')
  const [rollsLeft, setRollsLeft] = useState(STARTING_ROLLS)
  const mountedRef = useRef(false)

  // load every die picture and the throw animation once, as soon as the page opens
  useEffect(() => {
    mountedRef.current = true
    preloadFaces()
    preloadThrow()
    return () => { mountedRef.current = false }
  }, [])

  const total = values.reduce((sum, value) => sum + value, 0)
  const canRoll = !isRolling && rollsLeft > 0

  const handleRoll = async () => {
    if (!canRoll) return
    const result = rollDiceEven(DICE_COUNT) // the result is decided now, the animation only reveals it
    const animationUrl = newThrowUrl()      // a fresh URL, so the animation always starts from the beginning

    setThrowSrc(animationUrl)
    setIsRolling(true)
    setRollsLeft((left) => left - 1)

    // show the result only after BOTH the animation time has passed AND the new faces are loaded
    await Promise.all([wait(THROW_MS), ...result.map(loadFace)])

    releaseThrowUrl(animationUrl)
    if (!mountedRef.current) return
    setValues(result)
    setIsRolling(false)
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