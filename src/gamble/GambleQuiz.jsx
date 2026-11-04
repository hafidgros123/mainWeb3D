import { createPortal } from 'react-dom'
import axios from 'axios'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getRandomGambleQuestion } from './questions'
import './GambleQuiz.css'

const QUESTION_TIME_SECONDS = 30

function GambleQuiz({ onClose }) {
  const [question] = useState(getRandomGambleQuestion)
  const [stage, setStage] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(QUESTION_TIME_SECONDS)
  const [status, setStatus] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const currentQuestion = question.stages ? question.stages[stage] : question
  const isLastStage = !question.stages || stage === question.stages.length - 1

  const failAccount = useCallback(async (reason) => {
    if (submitting) return
    setSubmitting(true)
    setStatus(`${reason} Deleting your account...`)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setStatus('Your session expired. Please sign in again.')
      setSubmitting(false)
      return
    }
    let accountDeleted
    try {
      const response = await axios.post('/api/delete-account', {}, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        timeout: 30000,
      })
      accountDeleted = response.data.deleted
    } catch (error) {
      console.error('Failed to delete account after a failed gamble quiz:', error)
      setStatus('Account deletion failed. Contact the site owner immediately.')
      setSubmitting(false)
      return
    }
    if (accountDeleted === false) {
      onClose()
      return
    }
    await supabase.auth.signOut()
    onClose()
  }, [submitting])

  useEffect(() => {
    if (submitting) return undefined
    if (secondsLeft === 0) {
      void failAccount('Time ran out.')
      return undefined
    }
    const timer = window.setTimeout(() => setSecondsLeft((seconds) => seconds - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [secondsLeft, submitting, failAccount])

  function chooseAnswer(index) {
    if (submitting) return
    if (index === question.correctIndex) {
      onClose()
      return
    }
    if (question.stages && !isLastStage) {
      setStage((value) => value + 1)
      setSecondsLeft(QUESTION_TIME_SECONDS)
      return
    }
    void failAccount('Wrong answer.')
  }

  return createPortal(
    <div className="gamble-quiz-backdrop" role="presentation">
      <section
        className="gamble-quiz"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gamble-quiz-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="gamble-quiz-close"
          type="button"
          aria-label="Quit gamble quiz"
          onClick={() => void failAccount('You quit the quiz.')}
        >
          &times;
        </button>
        <div className="gamble-quiz-eyebrow">GAMBLE SECURITY CHECK</div>
        <h2 id="gamble-quiz-title">One last question</h2>
        <div className="gamble-quiz-timer" aria-live="polite">
          <span aria-hidden="true">TIME</span> {secondsLeft}s
        </div>
        <p className="gamble-quiz-prompt">{currentQuestion.prompt}</p>
        <div className="gamble-quiz-choices" role="group" aria-label="Answer choices">
          {currentQuestion.choices.map((choice, index) => (
            <button
              key={`${stage}-${index}`}
              className="gamble-quiz-choice"
              type="button"
              disabled={submitting}
              onClick={() => chooseAnswer(index)}
            >
              <span className="gamble-quiz-choice-number">{index + 1}</span>
              <span>{choice}</span>
            </button>
          ))}
        </div>
        {question.stages && <small className="gamble-quiz-progress">Question {stage + 1} of {question.stages.length}</small>}
        {status && <p className="gamble-quiz-status" role="alert">{status}</p>}
      </section>
    </div>,
    document.body,
  )
}

export default GambleQuiz
