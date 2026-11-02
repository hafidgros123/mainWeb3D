import { selectThreeDUnlocked, useProgression } from '../../store/progressionStore'
import TurnPlaceholder from '../../shared/TurnPlaceholder'

function ThreeDPage() {
  const threeDUnlocked = useProgression(selectThreeDUnlocked)

  if (!threeDUnlocked) {
    return (
      <main className="game-page three-d-page">
        <h1>3D experience locked</h1>
        <TurnPlaceholder
          message="locked access , cause : skill issue"
          detail="Complete any game to unlock this page."
        />
      </main>
    )
  }

  return (
    <main className="game-page three-d-page">
      <h1>3D Entry</h1>
      {/* Add the Three.js canvas and scene here when the 3D page is ready. */}
      <section className="game-placeholder" aria-label="3D experience placeholder">
        <TurnPlaceholder
          message="loading.....maybe you broke it maybe you didn't who knows (please et a better gpu)"
        />
      </section>
    </main>
  )
}

export default ThreeDPage
