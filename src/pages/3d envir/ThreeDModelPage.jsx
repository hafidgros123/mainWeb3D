import { Link, useParams } from 'react-router-dom'
import TurnPlaceholder from '../../shared/TurnPlaceholder'
import ModelComments from './ModelComments'
import ModelViewer from './ModelViewer'
import { MODEL_CATALOG } from './modelData'
import '../games/gamepage.css'
import './threeDPage.css'

function ThreeDModelPage() {
  const { modelId } = useParams()
  const model = MODEL_CATALOG.find((item) => item.id === modelId)

  if (!model) return <TurnPlaceholder message="That model was not found." detail={<Link to="/3d">Back to the 3D gallery</Link>} />

  return (
    <main className="game-page three-d-page">
      <Link className="back-to-gallery" to="/3d">← Back to gallery</Link>
      <p className="eyebrow">3D model</p>
      <h1>{model.title}</h1>
      <ModelViewer model={model} />
      <p className="model-description">{model.description}</p>
      <ModelComments modelId={model.id} />
    </main>
  )
}

export default ThreeDModelPage
