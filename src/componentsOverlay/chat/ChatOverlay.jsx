import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { selectSecretThemeUnlocked, useProgression } from '../../store/progressionStore'
import ChatBubbleButton from './ChatBubbleButton'
import ChatWindow from './ChatWindow'
import SignIn from '../sign/SignIn'
import SignInSuccessPopup from '../signinSuccess/SignInSuccessPopup'
import { supabase } from '../../lib/supabaseClient'
import { safeAvatarUrl } from '../../lib/avatar'
import { isOAuthUser } from '../../lib/auth'
import '../sign/SignIn.css'
import '../../pages/profile/profile.css' // styles the Profile link below
const CONFIRMATION_QUERY_PARAM = 'confirmed'
const PENDING_OAUTH_PROVIDER_KEY = 'pending-oauth-signin-provider'

function ChatOverlay({ theme, onThemeChange }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [showSignInSuccess, setShowSignInSuccess] = useState(false)
  const [successMusic, setSuccessMusic] = useState({ playing: false, stop: null, keepVisibleFor: 0 })
  const secretThemeUnlocked = useProgression(selectSecretThemeUnlocked)
  const unlockSecretTheme = useProgression((state) => state.unlockSecretTheme)
  const [isSignInOpen, setIsSignInOpen] = useState(false)
  const [profile, setProfile] = useState(null)
  const previousUserIdRef = useRef(null)
  const confirmationCelebrationShownRef = useRef(false)
  const confirmationAudioRef = useRef(null)
  const confirmationReturnRef = useRef(
    new URLSearchParams(window.location.search).get(CONFIRMATION_QUERY_PARAM) === '1'
  )
  const userId = user?.id ?? null

  const playSignInCelebration = () => {
    const audio = new Audio('/sounds/success.mp3')
    audio.volume = 0.6
    confirmationAudioRef.current?.pause()
    confirmationAudioRef.current = audio
    const stop = () => {
      audio.pause()
      setSuccessMusic({ playing: false, stop: null, keepVisibleFor: 10000 })
    }
    audio.addEventListener('ended', () => {
      if (confirmationAudioRef.current === audio) {
        confirmationAudioRef.current = null
        setSuccessMusic({ playing: false, stop: null, keepVisibleFor: 0 })
      }
    })
    setSuccessMusic({ playing: true, stop, keepVisibleFor: 0 })
    audio.play().catch(() => {
      if (confirmationAudioRef.current === audio) {
        confirmationAudioRef.current = null
        setSuccessMusic({ playing: false, stop: null, keepVisibleFor: 10000 })
      }
    })
  }

  useEffect(() => {
    const previousUserId = previousUserIdRef.current
    if (user && !previousUserId) {
      if (confirmationReturnRef.current && !confirmationCelebrationShownRef.current) {
        confirmationCelebrationShownRef.current = true
        setShowSignInSuccess(true)
        playSignInCelebration()
        confirmationReturnRef.current = false
        const cleanUrl = new URL(window.location.href)
        cleanUrl.searchParams.delete(CONFIRMATION_QUERY_PARAM)
        window.history.replaceState({}, '', cleanUrl)
      }

      const pendingOAuthProvider = window.localStorage.getItem(PENDING_OAUTH_PROVIDER_KEY)
      const returnedFromOAuth = Boolean(
        pendingOAuthProvider
        && isOAuthUser(user)
        && (
          user.app_metadata?.provider === pendingOAuthProvider
          || user.app_metadata?.providers?.includes(pendingOAuthProvider)
        )
      )
      if (returnedFromOAuth) {
        window.localStorage.removeItem(PENDING_OAUTH_PROVIDER_KEY)
        setShowSignInSuccess(true)
        playSignInCelebration()
      }
      if (isOAuthUser(user) && user.user_metadata?.profile_name_chosen !== true) {
        navigate('/profile')
      }
    }

    previousUserIdRef.current = user?.id ?? null
    if (!user) setSuccessMusic({ playing: false, stop: null, keepVisibleFor: 0 })
  }, [user, navigate])

  useEffect(() => () => {
    confirmationAudioRef.current?.pause()
  }, [])

  useEffect(() => {
    if (!userId) {
      setProfile(null)
      return
    }
    let cancelled = false

    const loadProfile = () =>
      supabase
        .from('profiles')
        .select('username, avatar_url')
        .eq('id', userId)
        .maybeSingle()
        .then(({ data }) => {
          if (!cancelled) setProfile(data)
        })

    loadProfile()

    // The profile page announces "profile-updated" after saving, so the picture refreshes at once.
    window.addEventListener('profile-updated', loadProfile)

    return () => {
      cancelled = true
      window.removeEventListener('profile-updated', loadProfile)
    }
  }, [userId])

  const avatarUrl = safeAvatarUrl(profile?.avatar_url)
  const avatarInitial = (profile?.username?.[0] || user?.email?.[0] || '?').toUpperCase()
  const closeSignInSuccess = () => {
    setShowSignInSuccess(false)
    setIsSignInOpen(false)
  }

  useEffect(() => {
    if (!successMusic.keepVisibleFor) return undefined

    const timer = window.setTimeout(
      () => setSuccessMusic((current) => ({ ...current, keepVisibleFor: 0 })),
      successMusic.keepVisibleFor
    )
    return () => window.clearTimeout(timer)
  }, [successMusic.keepVisibleFor])

  return (
    <>
      <div className="signin-theme-scope" data-signin-theme={theme}>
        {!user && (
          <button type="button" className="overlay-signin-btn" onClick={() => setIsSignInOpen(true)}>
            Sign In
          </button>
        )}

        {user && (
          <div className="overlay-profile-stack">
            <Link className="overlay-profile-link" to="/profile" aria-label="Your profile" title="Your profile">
              {avatarUrl ? (
                <img className="overlay-profile-avatar" src={avatarUrl} alt="" referrerPolicy="no-referrer" />
              ) : (
                <span className="overlay-profile-initial" aria-hidden="true">
                  {avatarInitial}
                </span>
              )}
            </Link>
            {(successMusic.playing || successMusic.keepVisibleFor > 0) && (
              <button
                type="button"
                className={`stop-success-sound-btn${successMusic.playing ? ' is-playing' : ' is-muted'}`}
                onClick={() => successMusic.stop?.()}
                aria-label="Stop success music"
                title={successMusic.playing ? 'Stop success music' : 'Success music has stopped'}
              >
              </button>
            )}
          </div>
        )}
        {!user && (successMusic.playing || successMusic.keepVisibleFor > 0) && (
          <div className="success-sound-stack">
            <button
              type="button"
              className={`stop-success-sound-btn${successMusic.playing ? ' is-playing' : ' is-muted'}`}
              onClick={() => successMusic.stop?.()}
              aria-label="Stop success music"
              title={successMusic.playing ? 'Stop success music' : 'Success music has stopped'}
            />
          </div>
        )}

        <SignIn
          isOpen={isSignInOpen}
          onClose={() => setIsSignInOpen(false)}
          onSuccess={() => setShowSignInSuccess(true)}
          onSuccessSoundChange={setSuccessMusic}
        />
        {showSignInSuccess && (
          <SignInSuccessPopup onClose={closeSignInSuccess} />
        )}
      </div>

      <aside className={`chat-overlay${isOpen ? ' chat-open' : ''}`}>
        <div className="chat-theme-controls">
          <div className="chat-theme-picker" role="group" aria-label="Background themes">
            <button className="chat-theme-swatch" type="button" data-theme="ki" aria-label="Ki background" aria-pressed={theme === 'ki'} onClick={() => onThemeChange('ki')} />
            <button className="chat-theme-swatch" type="button" data-theme="blue" aria-label="Blue background" aria-pressed={theme === 'blue'} onClick={() => onThemeChange('blue')} />
            <button className="chat-theme-swatch" type="button" data-theme="light-blue" aria-label="Light blue background" aria-pressed={theme === 'light-blue'} onClick={() => onThemeChange('light-blue')} />
            <button className="chat-theme-swatch" type="button" data-theme="crimson" aria-label="Crimson background" aria-pressed={theme === 'crimson'} onClick={() => onThemeChange('crimson')} />
            <button className="chat-theme-swatch" type="button" data-theme="gold" aria-label="Gold background" aria-pressed={theme === 'gold'} onClick={() => onThemeChange('gold')} />
            <button className="chat-theme-swatch" type="button" data-theme="jade" aria-label="Jade background" aria-pressed={theme === 'jade'} onClick={() => onThemeChange('jade')} />
            <button className="chat-theme-swatch" type="button" data-theme="jaws" aria-label="Jaws background" aria-pressed={theme === 'jaws'} onClick={() => onThemeChange('jaws')} />
            <button
              className={`chat-theme-swatch chat-theme-swatch--secret${secretThemeUnlocked ? '' : ' is-locked'}`}
              type="button"
              data-theme="secret"
              aria-label={secretThemeUnlocked ? 'Secret background' : 'Secret background locked. Finish all three games to unlock.'}
              aria-pressed={theme === 'secret'}
              disabled={!secretThemeUnlocked}
              title={secretThemeUnlocked ? 'Secret background' : 'Finish all three games to unlock the secret theme'}
              onClick={() => onThemeChange('secret')}
            />
          </div>
          {!secretThemeUnlocked && (
            <span className="chat-theme-lock-hint">Finish all three games to unlock the secret theme</span>
          )}
        </div>
        {isOpen ? (
          <ChatWindow
            onClose={() => setIsOpen(false)}
            onUnlockTheme={unlockSecretTheme}
            userId={userId}
            onRequireSignIn={() => setIsSignInOpen(true)}
          />
        ) : (
          <ChatBubbleButton onOpen={() => setIsOpen(true)} />
        )}
      </aside>
    </>
  )
}

export default ChatOverlay