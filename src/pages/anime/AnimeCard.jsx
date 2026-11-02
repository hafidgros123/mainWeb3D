import { Link } from 'react-router-dom'
import { episodesLabel } from '../../animeData/animeSource'
import FavoriteDiamond from './FavoriteDiamond'

function AnimeCard({ anime }) {
  return (
    <article className="anime-card">
      <Link className="anime-card-link" to={`/anime/${anime.id}`}>
        <div className="anime-card-cover">
          {anime.cover ? (
            <img src={anime.cover} alt={`Cover of ${anime.title}`} referrerPolicy="no-referrer" />
          ) : (
            <span className="anime-card-nocover" aria-hidden="true">
              {anime.title[0]?.toUpperCase()}
            </span>
          )}

          <div className="anime-card-bubble" aria-hidden="true">
            <strong>{episodesLabel(anime)}</strong>
            {anime.description && <span>{anime.description.slice(0, 180)}</span>}
          </div>
        </div>

        <p className="anime-card-title">
          {anime.title}
          {anime.seasonCount > 1 && <span className="anime-card-seasons"> · {anime.seasonCount} seasons</span>}
        </p>
      </Link>

      <FavoriteDiamond animeId={anime.id} title={anime.title} />
    </article>
  )
}

export default AnimeCard