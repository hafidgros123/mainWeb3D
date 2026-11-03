import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { safeAvatarUrl } from '../../lib/avatar'
import TurnPlaceholder from '../../shared/TurnPlaceholder'

const MAX_LENGTH = 500

function ModelComments({ modelId }) {
  const commentKey = `model:${modelId}`
  const [session, setSession] = useState(null)
  const [comments, setComments] = useState([])
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => data.subscription.unsubscribe()
  }, [])

  const loadComments = useCallback(async () => {
    // Use the existing game_id column so the same table policies and trigger apply.
    const { data, error } = await supabase
      .from('comments')
      .select('id, user_id, author_name, avatar_url, is_admin, body, created_at, profiles:profiles!comments_user_id_profile_fkey ( username, avatar_url )')
      .eq('game_id', commentKey)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Failed to load model comments:', error)
      setStatus('error')
      return
    }
    setComments(data)
    setStatus('ready')
  }, [commentKey])

  useEffect(() => {
    setStatus('loading')
    loadComments()
  }, [loadComments])

  async function handleSubmit(event) {
    event.preventDefault()
    const body = draft.trim()
    if (!body || posting) return
    setPosting(true)
    setFormError('')
    // The database supplies user_id, author details, and admin state.
    const { error } = await supabase.from('comments').insert({ game_id: commentKey, body })
    setPosting(false)
    if (error) {
      setFormError('Could not post your comment. Please try again in a moment.')
      return
    }
    setDraft('')
    loadComments()
  }

  async function handleDelete(id) {
    setFormError('')
    const { error } = await supabase.from('comments').delete().eq('id', id)
    if (error) {
      setFormError('Could not delete that comment.')
      return
    }
    setComments((previous) => previous.filter((comment) => comment.id !== id))
  }

  return (
    <section className="comments" aria-label="Comments">
      <h2 className="comments-title">Comments</h2>
      {session ? (
        <form className="comment-form" onSubmit={handleSubmit}>
          <textarea className="comment-input" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={MAX_LENGTH} rows={3} placeholder="Write a comment..." aria-label="Write a comment" />
          <div className="comment-form-footer">
            <span className="comment-count">{draft.length}/{MAX_LENGTH}</span>
            <button type="submit" className="comment-submit" disabled={posting || !draft.trim()}>{posting ? 'Posting...' : 'Post'}</button>
          </div>
        </form>
      ) : <p className="comments-note">Sign in (top right) to leave a comment.</p>}
      {formError && <p className="comments-error" role="alert">{formError}</p>}
      {status === 'loading' && <TurnPlaceholder message="loading others chuds (like you) comments....." />}
      {status === 'error' && <TurnPlaceholder message="failed to load.....how tf did you manage to break it " />}
      {status === 'ready' && comments.length === 0 && <p className="comments-note">No comments yet. Be the first!</p>}
      {status === 'ready' && comments.length > 0 && (
        <ul className="comments-list">
          {comments.map((comment) => {
            const profile = comment.profiles
            const avatar = safeAvatarUrl(profile ? profile.avatar_url : comment.avatar_url)
            return (
              <li key={comment.id} className="comment">
                <div className="comment-meta">
                  {avatar && <img className="comment-avatar" src={avatar} alt="" width="28" height="28" loading="lazy" />}
                  <span className="comment-author">{profile ? profile.username : comment.author_name}</span>
                  {comment.is_admin && <span className="comment-badge">Sorcerer Supreme</span>}
                  <time className="comment-date" dateTime={comment.created_at}>{new Date(comment.created_at).toLocaleDateString()}</time>
                  {session?.user?.id === comment.user_id && <button type="button" className="comment-delete" onClick={() => handleDelete(comment.id)}>Delete</button>}
                </div>
                <p className="comment-text">{comment.body}</p>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export default ModelComments
