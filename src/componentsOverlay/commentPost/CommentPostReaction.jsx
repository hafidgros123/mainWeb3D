import { useEffect, useRef, useState } from 'react'
import './CommentPostReaction.css'

const INITIAL_POSITION = {
  x: typeof window === 'undefined' ? 0 : window.innerWidth / 2,
  y: typeof window === 'undefined' ? 0 : window.innerHeight / 2,
}

function CommentPostReaction() {
  const videoRef = useRef(null)
  const pointerPositionRef = useRef(INITIAL_POSITION)
  const followTimerRef = useRef(null)
  const followUntilRef = useRef(0)
  const [position, setPosition] = useState(INITIAL_POSITION)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    function handlePointerMove(event) {
      const nextPosition = { x: event.clientX, y: event.clientY }
      pointerPositionRef.current = nextPosition
      if (Date.now() < followUntilRef.current) setPosition(nextPosition)
    }

    function handleCommentPosted() {
      setPosition(pointerPositionRef.current)
      setVisible(true)
      followUntilRef.current = Date.now() + 1000

      if (followTimerRef.current) window.clearTimeout(followTimerRef.current)
      followTimerRef.current = window.setTimeout(() => {
        followUntilRef.current = 0
      }, 1000)

      const video = videoRef.current
      if (!video) return
      video.currentTime = 0
      video.play().catch((error) => {
        console.error('Could not play the comment reaction:', error)
      })
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('comment-posted', handleCommentPosted)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('comment-posted', handleCommentPosted)
      if (followTimerRef.current) window.clearTimeout(followTimerRef.current)
    }
  }, [])

  return (
    <video
      ref={videoRef}
      className={`comment-post-reaction${visible ? ' comment-post-reaction-visible' : ''}`}
      style={{ left: position.x, top: position.y }}
      playsInline
      preload="auto"
      aria-hidden="true"
      onEnded={() => setVisible(false)}
    >
      <source src="/post.mp4" type="video/mp4" />
    </video>
  )
}

export default CommentPostReaction
