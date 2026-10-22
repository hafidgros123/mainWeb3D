import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { AVATAR_TYPES, MAX_AVATAR_BYTES, safeAvatarUrl } from '../../lib/avatar'
import './profile.css'

const EXTENSIONS = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }
const ALL_EXTENSIONS = ['png', 'jpg', 'webp']
const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/

function ProfilePage() {
  const navigate = useNavigate()
  const [authReady, setAuthReady] = useState(false)
  const [user, setUser] = useState(null)
  const userId = user?.id ?? null

  const [loaded, setLoaded] = useState(false)
  const [username, setUsername] = useState('')
  const [description, setDescription] = useState('')
  const [savedAvatar, setSavedAvatar] = useState(null) // the picture currently saved on the profile
  const [avatarFile, setAvatarFile] = useState(null) // a new picture the user just chose
  const [removeAvatar, setRemoveAvatar] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState({ type: '', text: '' }) // 'error' | 'success'
  const fileInputRef = useRef(null)

  // Follow the Supabase login state.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setAuthReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setAuthReady(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  // Load this user's profile.
  useEffect(() => {
    if (!userId) {
      setLoaded(false)
      return undefined
    }
    let cancelled = false
    setLoaded(false)

    supabase
      .from('profiles')
      .select('username, description, avatar_url')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || !data) {
          setStatus({ type: 'error', text: 'Could not load your profile.' })
          return
        }
        setUsername(data.username ?? '')
        setDescription(data.description ?? '')
        setSavedAvatar(data.avatar_url ?? null)
        setLoaded(true)
      })

    return () => {
      cancelled = true
    }
  }, [userId])

  // Preview of a newly chosen picture.
  useEffect(() => {
    if (!avatarFile) {
      setPreviewUrl(null)
      return undefined
    }
    const url = URL.createObjectURL(avatarFile)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [avatarFile])

  const shownAvatar = previewUrl ?? (removeAvatar ? null : safeAvatarUrl(savedAvatar))

  function handleFileChange(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (!AVATAR_TYPES.includes(file.type) || file.size > MAX_AVATAR_BYTES) {
      setStatus({ type: 'error', text: 'The picture must be a PNG, JPG or WebP image under 2 MB.' })
      return
    }
    setStatus({ type: '', text: '' })
    setAvatarFile(file)
    setRemoveAvatar(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/')
  }

  function handleRemovePicture() {
    setAvatarFile(null)
    setRemoveAvatar(true)
    setStatus({ type: '', text: '' })
  }

  async function handleSave(event) {
    event.preventDefault()
    if (saving || !userId || !loaded) return

    const name = username.trim()
    if (!USERNAME_PATTERN.test(name)) {
      setStatus({ type: 'error', text: 'Username: 3-20 characters, letters, numbers and _ only.' })
      return
    }

    setSaving(true)
    setStatus({ type: '', text: '' })

    try {
      // Is the username already used by somebody else? (the "_" is escaped so it is not a wildcard)
      const { data: taken, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', name.replace(/_/g, '\\_'))
        .neq('id', userId)
        .limit(1)
      if (checkError) throw checkError
      if (taken && taken.length > 0) {
        setStatus({ type: 'error', text: 'That username is already taken.' })
        return
      }

      let nextAvatar = savedAvatar

      if (avatarFile) {
        const extension = EXTENSIONS[avatarFile.type]
        const path = `${userId}/avatar.${extension}`
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type })
        if (uploadError) throw uploadError

        const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(path)
        nextAvatar = `${publicData.publicUrl}?v=${Date.now()}` // the ?v= stops the browser showing the old picture

        // Clean up an older picture saved in another format (best effort).
        const others = ALL_EXTENSIONS.filter((item) => item !== extension).map((item) => `${userId}/avatar.${item}`)
        await supabase.storage.from('avatars').remove(others)
      } else if (removeAvatar) {
        await supabase.storage.from('avatars').remove(ALL_EXTENSIONS.map((item) => `${userId}/avatar.${item}`))
        nextAvatar = null
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          username: name,
          description: description.trim() || null,
          avatar_url: nextAvatar,
        })
        .eq('id', userId)

      if (updateError) {
        if (updateError.code === '23505') {
          setStatus({ type: 'error', text: 'That username is already taken.' })
          return
        }
        throw updateError
      }

      setUsername(name)
      setSavedAvatar(nextAvatar)
      setAvatarFile(null)
      setRemoveAvatar(false)
      setStatus({ type: 'success', text: 'Profile saved.' })
      window.dispatchEvent(new Event('profile-updated')) // lets the top-right picture refresh right away
    } catch (error) {
      console.error(error)
      setStatus({ type: 'error', text: 'Could not save your profile. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="profile-page">
      <p className="eyebrow">Account</p>
      <h1>Profile</h1>

      <section className="profile-card" aria-label="Edit your profile">
        {!authReady && <p className="profile-note">Loading...</p>}

        {authReady && !user && <p className="profile-note">Sign in first (top right) to edit your profile.</p>}

        {authReady && user && !loaded && !status.text && <p className="profile-note">Loading your profile...</p>}

        {authReady && user && loaded && (
          <form className="profile-form" onSubmit={handleSave}>
            <div className="profile-avatar-row">
              {shownAvatar ? (
                <img className="profile-avatar" src={shownAvatar} alt="Your profile picture" />
              ) : (
                <div className="profile-avatar profile-avatar--empty" aria-hidden="true">
                  {(username.trim()[0] || '?').toUpperCase()}
                </div>
              )}

              <div className="profile-avatar-actions">
                <button type="button" className="profile-button" onClick={() => fileInputRef.current?.click()}>
                  Choose picture
                </button>
                {shownAvatar && (
                  <button type="button" className="profile-button profile-button--ghost" onClick={handleRemovePicture}>
                    Remove picture
                  </button>
                )}
                <small className="profile-hint">PNG, JPG or WebP, 2 MB max.</small>
              </div>

              <input
                ref={fileInputRef}
                className="profile-file-input"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                aria-label="Choose a profile picture"
                onChange={handleFileChange}
              />
            </div>

            <div className="profile-field">
              <label htmlFor="profile-username">Username</label>
              <input
                id="profile-username"
                className="profile-input"
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                maxLength={20}
                autoComplete="username"
                required
              />
              <small className="profile-hint">3-20 letters, numbers or _</small>
            </div>

            <div className="profile-field">
              <label htmlFor="profile-description">Description (optional)</label>
              <textarea
                id="profile-description"
                className="profile-input"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={200}
                rows={3}
              />
              <small className="profile-hint">{description.length}/200</small>
            </div>

            {status.text && (
              <p className={`profile-status profile-status--${status.type}`} role="alert">
                {status.text}
              </p>
            )}

            <div className="profile-actions">
              <button type="submit" className="profile-button profile-button--save" disabled={saving}>
                {saving ? 'Saving...' : 'Save profile'}
              </button>
              <button type="button" className="profile-button profile-button--ghost" onClick={handleSignOut}>
                Sign out
              </button>
            </div>
          </form>
        )}

        {authReady && user && !loaded && status.text && (
          <p className={`profile-status profile-status--${status.type}`} role="alert">
            {status.text}
          </p>
        )}
      </section>
    </main>
  )
}

export default ProfilePage