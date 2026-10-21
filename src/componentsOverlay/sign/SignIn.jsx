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

export default function SignIn({ isOpen, onClose }) {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [description, setDescription] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', text: '' }); // 'error' | 'success'
  const [successPlaying, setSuccessPlaying] = useState(false);
  const successAudioRef = useRef(null);
  const closeAfterSuccessSoundRef = useRef(false);

  const isSignUp = mode === 'signup';

  const stopSuccessSound = () => {
    const audio = successAudioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      successAudioRef.current = null;
    }
    setSuccessPlaying(false);

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
      setSuccessPlaying(true);

      audio.addEventListener('ended', () => {
        if (successAudioRef.current === audio) {
          successAudioRef.current = null;
          setSuccessPlaying(false);
          if (closeAfterSuccessSoundRef.current) {
            closeAfterSuccessSoundRef.current = false;
            onClose();
          }
        }
      });

      audio.play().catch(() => {
        if (successAudioRef.current === audio) {
          successAudioRef.current = null;
          setSuccessPlaying(false);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

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
            options: { data: { username, description: description.trim() } },
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
          // Email confirmation is enabled; keep the modal open so the success
          // message and sound control remain available.
          playSound('success');
          setStatus({
            type: 'success',
            text: 'Account created! Check your email to confirm it, then sign in.',
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

          {successPlaying && (
            <button
              type="button"
              className="stop-success-sound-btn"
              onClick={stopSuccessSound}
              aria-label="Stop success music"
            >
              🔇 Stop Music
            </button>
          )}
        </form>

        <p className="signup-redirect">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button type="button" className="mode-switch-btn" onClick={switchMode}>
            {isSignUp ? 'Sign in' : 'Sign up'}
          </button>
        </p>
      </div>
    </div>
  );
}