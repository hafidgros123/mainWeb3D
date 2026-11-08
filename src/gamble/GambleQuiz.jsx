import { createPortal } from 'react-dom'
import axios from 'axios'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { GAMBLE_QUESTIONS, getRandomGambleQuestion } from './questions'
import './GambleQuiz.css'

const QUESTION_TIME_SECONDS = 30

function GambleQuiz({ onClose }) {
  const [question, setQuestion] = useState(getRandomGambleQuestion)
  const [stage, setStage] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(QUESTION_TIME_SECONDS)
  const [status, setStatus] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [answer, setAnswer] = useState('')
  const [successVisible, setSuccessVisible] = useState(false)
  const [questionChanges, setQuestionChanges] = useState(0)

  const currentQuestion = question.stages ? question.stages[stage] : question
  const isLastStage = !question.stages || stage === question.stages.length - 1

  const failAccount = useCallback(async (reason) => {
    if (submitting) return
    setSubmitting(true)
    setStatus(`${reason} Checking account status...`)
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
      setStatus('Your admin status was removed. Your account was not deleted.')
      window.setTimeout(onClose, 2200)
      return
    }
    await supabase.auth.signOut()
    onClose()
  }, [submitting, onClose])

  useEffect(() => {
    if (submitting || successVisible || question.unlimitedTime) return undefined
    if (secondsLeft === 0) {
      void failAccount('Time ran out.')
      return undefined
    }
    const timer = window.setTimeout(() => setSecondsLeft((seconds) => seconds - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [secondsLeft, submitting, successVisible, question.unlimitedTime, failAccount])

  useEffect(() => {
    if (!successVisible) return undefined
    const timer = window.setTimeout(onClose, 2200)
    return () => window.clearTimeout(timer)
  }, [successVisible, onClose])

  function changeQuestion(direction) {
    const currentIndex = GAMBLE_QUESTIONS.findIndex((item) => item.id === question.id)
    const nextIndex = (currentIndex + direction + GAMBLE_QUESTIONS.length) % GAMBLE_QUESTIONS.length
    const nextQuestion = GAMBLE_QUESTIONS[nextIndex]
    const changes = questionChanges + 1
    setQuestionChanges(changes)
    setQuestion({
      ...nextQuestion,
      choices: nextQuestion.choices ? [...nextQuestion.choices] : undefined,
      stages: nextQuestion.stages?.map((item) => ({ ...item, choices: [...item.choices] })),
    })
    setStage(0)
    setAnswer('')
    setStatus('')
    setSecondsLeft(changes === 1 ? 20 : 10)
  }

  function showSuccess() {
    setSuccessVisible(true)
  }

  function chooseAnswer(index) {
    if (submitting) return
    const correct = currentQuestion.correctIndices
      ? currentQuestion.correctIndices.includes(index)
      : index === (currentQuestion.correctIndex ?? question.correctIndex)
    if (correct) {
      showSuccess()
      return
    }
    if (question.stages && !isLastStage) {
      setStage((value) => value + 1)
      setSecondsLeft(QUESTION_TIME_SECONDS)
      return
    }
    void failAccount('Wrong answer.')
  }

  function submitTextAnswer(event) {
    event.preventDefault()
    if (submitting) return
    const submittedAnswers = answer
      .split(',')
      .map((item) => item.trim().toLowerCase().replace(/\s+/g, ' '))
      .filter(Boolean)
    const expectedAnswers = currentQuestion.correctAnswers ?? question.correctAnswers
    if (expectedAnswers && submittedAnswers.length === expectedAnswers.length
      && submittedAnswers.every((item, index) => item === expectedAnswers[index])) {
      showSuccess()
      return
    }
    void failAccount('Wrong answer.')
  }

  return createPortal(
    <div className="gamble-quiz-backdrop" role="presentation">
      {successVisible ? (
        <section className="gamble-success-modal" role="status" aria-live="polite">
          <div className="gamble-success-icon" aria-hidden="true">&#10003;</div>
          <div className="gamble-success-eyebrow">ACCESS GRANTED</div>
          <h2>You escaped</h2>
          <p>wow you escaped ....this time</p>
        </section>
      ) : <section
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
        <button className="gamble-quiz-arrow gamble-quiz-arrow-left" type="button" disabled={submitting} onClick={() => changeQuestion(-1)} aria-label="Previous question">
          &#8592;
        </button>
        <button className="gamble-quiz-arrow gamble-quiz-arrow-right" type="button" disabled={submitting} onClick={() => changeQuestion(1)} aria-label="Next question">
          &#8594;
        </button>
        <div className="gamble-quiz-eyebrow">GAMBLE SECURITY CHECK</div>
        <h2 id="gamble-quiz-title">One last question</h2>
        <div className="gamble-quiz-timer" aria-live="polite">
          <span aria-hidden="true">TIME</span> {question.unlimitedTime ? '∞' : `${secondsLeft}s`}
        </div>
        <p className="gamble-quiz-prompt">{currentQuestion.prompt}</p>
        {currentQuestion.answerType === 'text' ? (
          <form className="gamble-quiz-text-answer" onSubmit={submitTextAnswer}>
            <input value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Separate the five names with commas" aria-label="Your answer" />
            <button type="submit" className="gamble-quiz-choice" disabled={submitting || !answer.trim()}>Submit answer</button>
          </form>
        ) : <div className="gamble-quiz-choices" role="group" aria-label="Answer choices">
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
        </div>}
        {question.stages && <small className="gamble-quiz-progress">Question {stage + 1} of {question.stages.length}</small>}
      </section>}
      {!successVisible && status && <p className="gamble-quiz-status" role="alert">{status}</p>}
    </div>,
    document.body,
  )
}

export default GambleQuiz
