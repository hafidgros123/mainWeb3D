import { useEffect } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import './VideoPage.css'

function VideoPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const src = params.get('src') ?? ''
  const forced = params.get('forced') === '1'
  const isImage = params.get('type') === 'image'

  const goHome = () => navigate('/', { replace: true })

  // images never "end", so send the player back after 5 seconds
  useEffect(() => {
    if (!isImage) return
    const t = setTimeout(goHome, 1000)
    return () => clearTimeout(t)
  }, [isImage])

  const isSafe = src.startsWith('/') && !src.startsWith('//')
  if (!isSafe) return <Navigate to="/" replace />

  return (
    <main className="video-page">
      {isImage ? (
        <img className="video-page-player" src={src} alt="" />
      ) : (
        <video
          className="video-page-player"
          src={src}
          autoPlay
          playsInline
          disablePictureInPicture
          controls={!forced}
          controlsList="nodownload noremoteplayback"
          onEnded={goHome}
          onPause={forced ? (event) => { if (!event.currentTarget.ended) event.currentTarget.play() } : undefined}
          onContextMenu={forced ? (event) => event.preventDefault() : undefined}
        />
      )}
      {!forced && <button className="video-page-close" type="button" onClick={goHome}>Back</button>}
    </main>
  )
}

export default VideoPage