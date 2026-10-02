import { selectThreeDUnlocked, useProgression } from '../store/progressionStore'

function ThreeDPage() {
  const threeDUnlocked = useProgression(selectThreeDUnlocked)

  if (!threeDUnlocked) {
    return (
      <main className="game-page three-d-page">
        <h1>3D experience locked</h1>
        <p>Complete any game to unlock this page.</p>
      </main>
    )
  }

  return (
    <main className="game-page three-d-page">
      <h1>3D Entry</h1>
      {/* Add the Three.js canvas and scene here when the 3D page is ready. */}
      <section className="game-placeholder" aria-label="3D experience placeholder">
        <p>Three.js scene placeholder</p>
      </section>
    </main>
  )
}

export default ThreeDPage
