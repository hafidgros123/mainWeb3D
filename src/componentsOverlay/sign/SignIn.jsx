import React, { useState, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient'; // Adjust if your file lives elsewhere
import './SignIn.css';

const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

async function uploadAvatar(userId, file) {
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${userId}/avatar.${ext}`;
  const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
  if (error) {
    console.error(error);
    return;
  }
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ avatar_url: `${data.publicUrl}?v=${Date.now()}` })
    .eq('id', userId);
  if (profileError) console.error(profileError);
}

export default function SignIn({ isOpen, onClose, onSuccess, onSuccessSoundChange }) {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [description, setDescription] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [oauthProvider, setOauthProvider] = useState('');
  const [status, setStatus] = useState({ type: '', text: '' }); // 'error' | 'success'
  const successAudioRef = useRef(null);
  const closeAfterSuccessSoundRef = useRef(false);

  const isSignUp = mode === 'signup';

  const toggleSuccessSound = () => {
    const audio = successAudioRef.current;
    if (!audio) return;

    if (audio.paused) {
      audio.play().then(() => {
        onSuccessSoundChange?.({ playing: true, stop: toggleSuccessSound, keepVisibleFor: 0 });
      }).catch(() => {
        onSuccessSoundChange?.({ playing: false, stop: toggleSuccessSound, keepVisibleFor: 10000 });
      });
      return;
    }

    audio.pause();
    onSuccessSoundChange?.({ playing: false, stop: toggleSuccessSound, keepVisibleFor: 10000 });

    // Preserve the usual close-after-success behavior, while allowing the user
    // to stop the sound first. This only applies after a successful sign-in or
    // sign-up that produced a session.
    if (closeAfterSuccessSoundRef.current) {
      closeAfterSuccessSoundRef.current = false;
      onClose();
    }
  };

  const playSound = (type, { closeWhenFinished = false } = {}) => {
    if (type === 'success' && successAudioRef.current) {
      successAudioRef.current.pause();
      successAudioRef.current.currentTime = 0;
    }

    const audio = new Audio(type === 'success' ? '/sounds/success.mp3' : '/sounds/fail.mp3');
    audio.volume = 0.6;

    if (type === 'success') {
      successAudioRef.current = audio;
      closeAfterSuccessSoundRef.current = closeWhenFinished;
      onSuccessSoundChange?.({ playing: true, stop: toggleSuccessSound, keepVisibleFor: 0 });

      audio.addEventListener('ended', () => {
        if (successAudioRef.current === audio) {
          successAudioRef.current = null;
          onSuccessSoundChange?.({ playing: false, stop: null, keepVisibleFor: 0 });
          if (closeAfterSuccessSoundRef.current) {
            closeAfterSuccessSoundRef.current = false;
            onClose();
          }
        }
      });

      audio.play().catch(() => {
        if (successAudioRef.current === audio) {
          successAudioRef.current = null;
          onSuccessSoundChange?.({ playing: false, stop: null, keepVisibleFor: 0 });
          if (closeAfterSuccessSoundRef.current) {
            closeAfterSuccessSoundRef.current = false;
            onClose();
          }
        }
      });
      return;
    }

    audio.play().catch(() => {});
  };

  if (!isOpen) return null;

  const switchMode = () => {
    setMode(isSignUp ? 'signin' : 'signup');
    setStatus({ type: '', text: '' });
  };

  const handleOAuthSignIn = async (provider) => {
    if (loading || oauthProvider) return;

    setOauthProvider(provider);
    setStatus({ type: '', text: '' });

    try {
      window.localStorage.setItem('pending-oauth-signin-provider', provider);
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin },
      });

      if (error) {
        window.localStorage.removeItem('pending-oauth-signin-provider');
        setStatus({ type: 'error', text: error.message });
        setOauthProvider('');
      }
    } catch (err) {
      window.localStorage.removeItem('pending-oauth-signin-provider');
      console.error(err);
      setStatus({ type: 'error', text: 'Could not start sign-in. Please try again.' });
      setOauthProvider('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading || oauthProvider) return;

    setLoading(true);
    setStatus({ type: '', text: '' });

    try {
      if (isSignUp) {
        if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
          playSound('fail');
          setStatus({ type: 'error', text: 'Username: 3-20 characters, letters, numbers and _ only.' });
          return;
        }

        if (avatarFile && (!AVATAR_TYPES.includes(avatarFile.type) || avatarFile.size > 2 * 1024 * 1024)) {
          playSound('fail');
          setStatus({ type: 'error', text: 'Avatar must be a PNG, JPG or WebP image under 2 MB.' });
          return;
        }

        const { data: taken, error: usernameCheckError } = await supabase
          .from('profiles')
          .select('id')
          .ilike('username', username)
          .maybeSingle();

        if (usernameCheckError) throw usernameCheckError;
        if (taken) {
          playSound('fail');
          setStatus({ type: 'error', text: 'That username is already taken.' });
          return;
        }
      }

      const { data, error } = isSignUp
        ? await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { username, description: description.trim() },
              emailRedirectTo: (() => {
                const confirmationUrl = new URL(window.location.href)
                confirmationUrl.searchParams.set('confirmed', '1')
                return confirmationUrl.toString()
              })(),
            },
          })
        : await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        playSound('fail');
        setStatus({ type: 'error', text: error.message });
        return;
      }

      if (isSignUp) {
        // Supabase may return a user with no identities when this email already exists.
        if (data.user && data.user.identities?.length === 0) {
          playSound('fail');
          setStatus({ type: 'error', text: 'An account with this email already exists.' });
          return;
        }

        if (data.session && avatarFile) {
          // With email confirmation disabled, the new user is already signed in.
          await uploadAvatar(data.user.id, avatarFile);
        }

        if (!data.session) {
          // Email confirmation is enabled; wait to show the celebration until
          // the user returns and signs in with the confirmed account.
          setStatus({
            type: 'success',
            text: 'Go to your emails (maybe the spam) and come back.',
          });
          setMode('signin');
          setPassword('');
          return;
        }
      }

      // A session exists. Keep the modal visible while the success sound plays,
      // with the stop button directly under the submit button. It closes when
      // the sound ends or when the user presses Stop Music.
      setPassword('');
      setAvatarFile(null);
      setMode('signin');
      onSuccess?.();
      playSound('success', { closeWhenFinished: true });
    } catch (err) {
      console.error(err);
      playSound('fail');
      setStatus({
        type: 'error',
        text: 'Could not reach the server. Check your .env values and restart the dev server.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!email) {
      setStatus({ type: 'error', text: 'Enter your email first.' });
      return;
    }

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: window.location.origin },
      });
      setStatus(
        error
          ? { type: 'error', text: error.message }
          : { type: 'success', text: 'Confirmation email sent. Check your inbox and spam.' }
      );
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', text: 'Could not send the confirmation email.' });
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!email) {
      setStatus({ type: 'error', text: 'Enter your email first, then click Forgot.' });
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      setStatus(
        error
          ? { type: 'error', text: error.message }
          : { type: 'success', text: 'Password reset email sent.' }
      );
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', text: 'Could not send the password reset email.' });
    }
  };

  return (
    <div className="signin-overlay" onClick={onClose}>
      <div className="signin-card" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="close-modal-btn"
          onClick={onClose}
          aria-label="Close sign-in"
        >
          &times;
        </button>

        <h2>{isSignUp ? 'Create Account' : 'Welcome Back'}</h2>

        <p className="signin-subtitle">
          {isSignUp
            ? 'Enter your details to create an account'
            : 'Please enter your details to sign in'}
        </p>

        <form onSubmit={handleSubmit} className="signin-form">
          {isSignUp && (
            <>
              <div className="input-group">
                <label htmlFor="signin-username">Username</label>
                <input
                  type="text"
                  id="signin-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="3-20 letters, numbers, _"
                  autoComplete="username"
                  maxLength={20}
                  required
                />
              </div>

              <div className="input-group">
                <label htmlFor="signin-description">Description (optional)</label>
                <textarea
                  id="signin-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell us about yourself"
                  maxLength={200}
                  rows={3}
                />
              </div>

              <div className="input-group">
                <label htmlFor="signin-avatar">Avatar (optional)</label>
                <input
                  type="file"
                  id="signin-avatar"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </>
          )}

          <div className="input-group">
            <label htmlFor="signin-email">Email Address</label>
            <input
              type="email"
              id="signin-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              autoComplete="email"
              required
            />
          </div>

          <div className="input-group">
            <div className="password-label-row">
              <label htmlFor="signin-password">Password</label>
              {!isSignUp && (
                <a href="#forgot" className="forgot-password" onClick={handleForgotPassword}>
                  Forgot?
                </a>
              )}
            </div>

            <input
              type="password"
              id="signin-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isSignUp ? 'At least 6 characters' : 'Enter your password'}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              minLength={6}
              required
            />
          </div>

          {status.text && (
            <p className={`signin-status ${status.type}`} role="alert">
              {status.text}
            </p>
          )}

          {/not confirmed/i.test(status.text) && (
            <button type="button" className="mode-switch-btn" onClick={handleResendConfirmation}>
              Resend confirmation email
            </button>
          )}

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? 'Please wait...' : isSignUp ? 'Sign Up' : 'Sign In'}
          </button>

        </form>

        <p className="signup-redirect">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button type="button" className="mode-switch-btn" onClick={switchMode}>
            {isSignUp ? 'Sign in' : 'Sign up'}
          </button>
        </p>

        <div className="signin-oauth">
          <p className="signin-oauth-label">Or continue with</p>
          <div className="signin-oauth-buttons">
            <button
              type="button"
              className="signin-oauth-btn"
              onClick={() => handleOAuthSignIn('google')}
              disabled={loading || Boolean(oauthProvider)}
              aria-label="Continue with Google"
              title="Continue with Google"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M21.35 12.23c0-.72-.06-1.42-.18-2.09H12v3.96h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.26Z" />
                <path fill="#34A853" d="M12 21.75c2.63 0 4.83-.87 6.44-2.36l-3.14-2.45c-.87.58-1.98.93-3.3.93-2.54 0-4.69-1.71-5.46-4.01H3.3v2.53A9.73 9.73 0 0 0 12 21.75Z" />
                <path fill="#FBBC05" d="M6.54 13.86a5.84 5.84 0 0 1 0-3.72V7.61H3.3a9.75 9.75 0 0 0 0 8.78l3.24-2.53Z" />
                <path fill="#EA4335" d="M12 6.13c1.43 0 2.71.49 3.72 1.47l2.79-2.79C16.82 3.2 14.62 2.25 12 2.25a9.73 9.73 0 0 0-8.7 5.36l3.24 2.53c.77-2.3 2.92-4.01 5.46-4.01Z" />
              </svg>
            </button>
            <button
              type="button"
              className="signin-oauth-btn"
              onClick={() => handleOAuthSignIn('github')}
              disabled={loading || Boolean(oauthProvider)}
              aria-label="Continue with GitHub"
              title="Continue with GitHub"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path fill="currentColor" d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.56.1.76-.24.76-.54v-2.1c-3.1.68-3.76-1.32-3.76-1.32-.5-1.3-1.24-1.65-1.24-1.65-1.01-.7.08-.69.08-.69 1.12.08 1.71 1.15 1.71 1.15 1 .1.77 2.57 3.91 1.82.1-.73.39-1.23.7-1.51-2.47-.28-5.06-1.24-5.06-5.51 0-1.22.44-2.22 1.15-3-.12-.28-.5-1.42.11-2.96 0 0 .94-.3 3.05 1.14a10.6 10.6 0 0 1 5.55 0c2.12-1.44 3.05-1.14 3.05-1.14.61 1.54.23 2.68.11 2.96.72.78 1.15 1.78 1.15 3 0 4.28-2.6 5.23-5.08 5.5.4.35.76 1.03.76 2.08v3.08c0 .3.2.65.77.54A11.1 11.1 0 0 0 12 .9Z" />
              </svg>
            </button>
            <button
              type="button"
              className="signin-oauth-btn"
              onClick={() => handleOAuthSignIn('facebook')}
              disabled={loading || Boolean(oauthProvider)}
              aria-label="Continue with Facebook"
              title="Continue with Facebook"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path fill="currentColor" d="M13.5 21v-8.2h2.76l.41-3.2H13.5V7.56c0-.93.26-1.56 1.59-1.56h1.7V3.14c-.29-.04-1.3-.14-2.48-.14-2.46 0-4.14 1.5-4.14 4.26V9.6H7.4v3.2h2.77V21h3.33Z" />
              </svg>
            </button>
            <button
              type="button"
              className="signin-oauth-btn"
              onClick={() => handleOAuthSignIn('discord')}
              disabled={loading || Boolean(oauthProvider)}
              aria-label="Continue with Discord"
              title="Continue with Discord"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path fill="currentColor" d="M19.27 5.33A18.2 18.2 0 0 0 14.8 3.95l-.56 1.14a16.8 16.8 0 0 0-4.48 0L9.2 3.95a18.2 18.2 0 0 0-4.47 1.38C1.9 9.5 1.14 13.57 1.52 17.58a18 18 0 0 0 5.48 2.77l1.18-1.92a11.7 11.7 0 0 1-1.86-.9l.46-.36a12.9 12.9 0 0 0 10.44 0l.46.36c-.6.36-1.23.66-1.87.9L17 20.35a18 18 0 0 0 5.48-2.77c.45-4.65-.77-8.68-3.21-12.25ZM8.73 14.9c-1.02 0-1.86-.94-1.86-2.1s.82-2.1 1.86-2.1 1.88.95 1.86 2.1c0 1.16-.82 2.1-1.86 2.1Zm6.54 0c-1.02 0-1.86-.94-1.86-2.1s.82-2.1 1.86-2.1 1.88.95 1.86 2.1c0 1.16-.82 2.1-1.86 2.1Z" />
              </svg>
            </button>
          </div>
          {oauthProvider && (
            <p className="signin-oauth-pending" role="status">
              Connecting to {oauthProvider}...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}