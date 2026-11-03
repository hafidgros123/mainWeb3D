import { Link } from 'react-router-dom'
import { selectThreeDUnlocked, useProgression } from '../../store/progressionStore'
import TurnPlaceholder from '../../shared/TurnPlaceholder'
import { MODEL_CATALOG } from './modelData'
import ModelPreview from './ModelPreview'
import './threeDPage.css'

function ThreeDPage() {
  const threeDUnlocked = useProgression(selectThreeDUnlocked)

  if (!threeDUnlocked) {
    return (
      <main className="game-page three-d-page">
        <h1>3D gallery locked</h1>
        <TurnPlaceholder
          className="three-d-locked-placeholder"
          message="locked access , cause : skill issue"
          detail="Complete any game to unlock this page."
        />
      </main>
    )
  }

  return (
    <main className="game-page three-d-page">
      <p className="eyebrow">Interactive collection</p>
      <h1>3D Gallery</h1>
      <p className="three-d-intro">Browse the weird/funny models . Open one to spin it around and leave a comment or wrtie a command</p>
      {MODEL_CATALOG.length === 0 ? (
        <section className="model-empty">
          <h2>No models yet</h2>
          <p>Put a <code>.glb</code> file in <code>public/models/</code>, then add its details to <code>modelData.js</code>.</p>
        </section>
      ) : (
        <div className="model-grid">
          {MODEL_CATALOG.map((model) => (
            <Link className="model-card" to={`/3d/${model.id}`} key={model.id}>
              <div className="model-card-preview">
                {model.thumbnail ? <img src={model.thumbnail} alt="" /> : <ModelPreview model={model} />}
              </div>
              <div className="model-card-body">
                <h2>{model.title}</h2>
                <p>{model.description}</p>
                <small>Open viewer →</small>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}

export default ThreeDPage
