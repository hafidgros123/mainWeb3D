import { Link } from 'react-router-dom'
import { gameDefinitions } from '../../gamesData/gameDefinitions'

function GameListPage() {
  return (
    <main className="game-page">
      <p className="eyebrow">Quest archive</p>
      <h1>Games</h1>
      <p className="page-intro">Choose one game. Each game will load separately so only one WebGL experience runs at a time.</p>
      <div className="game-grid">
        {gameDefinitions.map((game) => <Link className="game-card" to={`/games/${game.id}`} key={game.id}><span className="game-number">{game.number}</span><strong>{game.title}</strong></Link>)}
      </div>
    </main>
  )
}

export default GameListPage
