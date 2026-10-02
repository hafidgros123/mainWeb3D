import { useParams } from 'react-router-dom'
import { gameDefinitions } from '../../gamesData/gameDefinitions'

function GamePage() {
  const { gameId } = useParams()
  const game = gameDefinitions.find((definition) => definition.id === gameId)

  if (!game) {
    return <p>Game not found.</p>
  }

  return (
    <main className="game-page">
      <p className="eyebrow">Game {game.number}</p>
      <h1>{game.title}</h1>

      {/* Replace this section with the Unity WebGL embed after exporting the game. */}
      <section className="game-placeholder" aria-label={`${game.title} placeholder`}>
        <p>Unity game placeholder</p>
        <small>Put the WebGL build in public/unity/{game.id}/.</small>
      </section>
    </main>
  )
}

export default GamePage
