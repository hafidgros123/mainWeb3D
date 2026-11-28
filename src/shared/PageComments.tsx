import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { safeAvatarUrl } from '../lib/avatar'
import TurnPlaceholder from './TurnPlaceholder'

const MAX_LENGTH = 500

// The live profile of the person who wrote the comment (joined in by the select below).
interface CommentProfile {
  username: string
  avatar_url: string | null
  title: string | null
}

interface CommentRow {
  id: string | number
  user_id: string
  author_name: string | null // what was saved with the comment, used if the profile is gone
  avatar_url: string | null
  is_admin: boolean
  body: string
  created_at: string
  profiles: CommentProfile | null
}

type LoadStatus = 'loading' | 'ready' | 'error'

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// One comment box for every page. "sectionId" is the name of the page's comment section in the
// database (comments.section_id): a game is "game-one", a 3D model "model:<id>", an anime
// "anime-<id>", the main page "main-page".
function PageComments({ sectionId }: { sectionId: string }) {
  const { session, isAdmin } = useAuth()
  const [comments, setComments] = useState<CommentRow[]>([])
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)
  const [formError, setFormError] = useState('')

  const loadComments = useCallback(async () => {
    // "profiles" is joined in live, so a changed username or picture shows on every comment.
    const { data, error } = await supabase
      .from('comments')
      .select(
        'id, user_id, author_name, avatar_url, is_admin, body, created_at, profiles:profiles!comments_user_id_profile_fkey ( username, avatar_url, title )'
      )
      .eq('section_id', sectionId)
      .order('is_admin', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error(error)
      setStatus('error')
      return
    }
    setComments((data ?? []) as unknown as CommentRow[])
    setStatus('ready')
  }, [sectionId])

  useEffect(() => {
    setStatus('loading')
    void loadComments()
  }, [loadComments])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const body = draft.trim()
    if (!body || posting) return

    setPosting(true)
    setFormError('')
    // Only the section and the text are sent. The user id and admin badge are set by the database.
    const { error } = await supabase.from('comments').insert({ section_id: sectionId, body })
    setPosting(false)

    if (error) {
      setFormError('Could not post your comment. Please try again in a moment.')
      return
    }
    setDraft('')
    window.dispatchEvent(new Event('comment-posted'))
    void loadComments()
  }

  async function handleDelete(id: CommentRow['id']) {
    setFormError('')
    const { error } = await supabase.from('comments').delete().eq('id', id)
    if (error) {
      setFormError('Could not delete that comment.')
      return
    }
    setComments((previous) => previous.filter((comment) => comment.id !== id))
    window.dispatchEvent(new Event('comment-posted'))
  }

  return (
    <section className="comments" aria-label="Comments">
      <h2 className="comments-title">Comments</h2>

      {session ? (
        <form className="comment-form" onSubmit={handleSubmit}>
          <textarea
            className="comment-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={MAX_LENGTH}
            rows={3}
            placeholder="Write a comment..."
            aria-label="Write a comment"
          />
          <div className="comment-form-footer">
            <span className="comment-count">
              {draft.length}/{MAX_LENGTH}
            </span>
            <button type="submit" className="comment-submit" disabled={posting || !draft.trim()}>
              {posting ? 'Posting...' : 'Post'}
            </button>
          </div>
        </form>
      ) : (
        <p className="comments-note">Sign in (top right) to leave a comment.</p>
      )}

      {formError && (
        <p className="comments-error" role="alert">
          {formError}
        </p>
      )}

      {status === 'loading' && (
        <TurnPlaceholder message="loading others chuds (like you) comments....." />
      )}
      {status === 'error' && (
        <TurnPlaceholder message="failed to load.....how tf did you manage to break it " />
      )}
      {status === 'ready' && comments.length === 0 && (
        <p className="comments-note">No comments yet. Be the first!</p>
      )}

      {status === 'ready' && comments.length > 0 && (
        <ul className="comments-list">
          {comments.map((comment) => {
            // Live profile if there is one, otherwise what was saved with the comment.
            const profile = comment.profiles
            const name = profile ? profile.username : comment.author_name
            const avatar = safeAvatarUrl(profile ? profile.avatar_url : comment.avatar_url)

            return (
              <li key={comment.id} className="comment">
                <div className="comment-meta">
                  {avatar && (
                    <img
                      className="comment-avatar"
                      src={avatar}
                      alt=""
                      width="28"
                      height="28"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <span className="comment-author">{name}</span>
                  {/* an admin's title (set on the profile page) is shown next to the name; "Supreme" until they pick one */}
                  {comment.is_admin && <span className="comment-badge">{profile?.title || 'Supreme'}</span>}
                  <time className="comment-date" dateTime={comment.created_at}>
                    {formatDate(comment.created_at)}
                  </time>
                  {/* everyone can delete their own comments, admins can delete anybody's (the database checks it too) */}
                  {(isAdmin === true || session?.user?.id === comment.user_id) && (
                    <button type="button" className="comment-delete" onClick={() => void handleDelete(comment.id)}>
                      Delete
                    </button>
                  )}
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

export default PageComments
