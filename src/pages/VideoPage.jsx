import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import './VideoPage.css'

// A page that shows ONLY a video. Address: /watch?src=/num27-31/rat.mp4
// Add &forced=1 to make it unskippable (no controls, no pausing, no Back button).
function VideoPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const src = params.get('src') ?? ''
  const forced = params.get('forced') === '1'

  const goHome = () => navigate('/', { replace: true })

  // only allow videos from this site (a path like /folder/file.mp4), never another website
  const isSafe = src.startsWith('/') && !src.startsWith('//')
  if (!isSafe) return <Navigate to="/" replace />

  return (
    <main className="video-page">
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
      {!forced && <button className="video-page-close" type="button" onClick={goHome}>Back</button>}
    </main>
  )
}

export default VideoPage