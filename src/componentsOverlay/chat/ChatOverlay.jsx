import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { selectSecretThemeUnlocked, useProgression } from '../../store/progressionStore'
import ChatBubbleButton from './ChatBubbleButton'
import ChatWindow from './ChatWindow'
import SignIn from '../sign/SignIn'
import { supabase } from '../../lib/supabaseClient'
import { safeAvatarUrl } from '../../lib/avatar'
import '../sign/SignIn.css'
import '../../pages/profile/profile.css' // styles the Profile link below
// Force a fresh sign-in after this long, counted from the user's last real sign-in.
const SESSION_MAX_AGE_MS = 48 * 60 * 60 * 1000
const SESSION_CHECK_EVERY_MS = 5 * 60 * 1000

function isSessionExpired(user) {
  const lastSignIn = Date.parse(user?.last_sign_in_at ?? '')
  return Number.isFinite(lastSignIn) && Date.now() - lastSignIn > SESSION_MAX_AGE_MS
}

function ChatOverlay({ theme, onThemeChange }) {
  const [isOpen, setIsOpen] = useState(false)
  const secretThemeUnlocked = useProgression(selectSecretThemeUnlocked)
  const unlockSecretTheme = useProgression((state) => state.unlockSecretTheme)
  const [isSignInOpen, setIsSignInOpen] = useState(false)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const userId = user?.id ?? null

  useEffect(() => {
    const applySession = (session) => {
      const nextUser = session?.user ?? null
      if (nextUser && isSessionExpired(nextUser)) {
        // Deferred: don't call auth methods synchronously inside the auth callback.
        setTimeout(() => supabase.auth.signOut(), 0)
        setUser(null)
        return
      }
      setUser(nextUser)
    }

    const checkSession = () =>
      supabase.auth.getSession().then(({ data }) => applySession(data.session))

    checkSession()
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => applySession(session))
    const timer = setInterval(checkSession, SESSION_CHECK_EVERY_MS)

    return () => {
      sub.subscription.unsubscribe()
      clearInterval(timer)
    }
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

  return (
    <>
      <div className="signin-theme-scope" data-signin-theme={theme}>
        {!user && (
          <button type="button" className="overlay-signin-btn" onClick={() => setIsSignInOpen(true)}>
            Sign In
          </button>
        )}

        {user && (
          <Link className="overlay-profile-link" to="/profile" aria-label="Your profile" title="Your profile">
            {avatarUrl ? (
              <img className="overlay-profile-avatar" src={avatarUrl} alt="" referrerPolicy="no-referrer" />
            ) : (
              <span className="overlay-profile-initial" aria-hidden="true">
                {avatarInitial}
              </span>
            )}
          </Link>
        )}

        <SignIn
          isOpen={isSignInOpen}
          onClose={() => setIsSignInOpen(false)}
        />
      </div>

      <aside className={`chat-overlay${isOpen ? ' chat-open' : ''}`}>
        <div className="chat-theme-controls">
          <div className="chat-theme-picker" role="group" aria-label="Background themes">
            <button className="chat-theme-swatch" type="button" data-theme="blue" aria-label="Blue background" aria-pressed={theme === 'blue'} onClick={() => onThemeChange('blue')} />
            <button className="chat-theme-swatch" type="button" data-theme="light-blue" aria-label="Light blue background" aria-pressed={theme === 'light-blue'} onClick={() => onThemeChange('light-blue')} />
            <button className="chat-theme-swatch" type="button" data-theme="crimson" aria-label="Crimson background" aria-pressed={theme === 'crimson'} onClick={() => onThemeChange('crimson')} />
            <button className="chat-theme-swatch" type="button" data-theme="gold" aria-label="Gold background" aria-pressed={theme === 'gold'} onClick={() => onThemeChange('gold')} />
            <button className="chat-theme-swatch" type="button" data-theme="jade" aria-label="Jade background" aria-pressed={theme === 'jade'} onClick={() => onThemeChange('jade')} />
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
          <ChatWindow onClose={() => setIsOpen(false)} onUnlockTheme={unlockSecretTheme} />
        ) : (
          <ChatBubbleButton onOpen={() => setIsOpen(true)} />
        )}
      </aside>
    </>
  )
}

export default ChatOverlay