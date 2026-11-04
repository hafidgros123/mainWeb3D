import { useEffect } from 'react'
import './SignInSuccessPopup.css'

function SignInSuccessPopup({ onClose }) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 20000)
    return () => window.clearTimeout(timer)
  }, [onClose])

  return (
    <div className="signin-success-overlay" role="presentation" onClick={onClose}>
      <section
        className="signin-success-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="signin-success-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="signin-success-close"
          type="button"
          onClick={onClose}
          aria-label="Close sign-in success message"
        >
          &times;
        </button>
        <>
         <h2 id="signin-success-title">you're now connected</h2>
        <p>good boy...</p>
        </>
        <img
          className="signin-success-image"
          src="/goodBoy/good-boy.webp"
          alt=""
        />
        <button className="signin-success-dismiss" type="button" onClick={onClose}>
          Continue
        </button>
      </section>
    </div>
  )
}

export default SignInSuccessPopup
