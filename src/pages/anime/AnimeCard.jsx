import { Link } from 'react-router-dom'
import { episodesLabel } from '../../animeData/animeSource'
import FavoriteDiamond from './FavoriteDiamond'

const BUBBLE_MAX_CHARS = 260

function shorten(text) {
  if (text.length <= BUBBLE_MAX_CHARS) return text
  return `${text.slice(0, BUBBLE_MAX_CHARS).trimEnd()}…`
}

// One anime box. Pressing the diamond favorites it; pressing anywhere else opens its info page.
// On desktop, hovering shows the description and the number of episodes over the cover.
function AnimeCard({ anime }) {
  return (
    <article className="anime-card">
      <Link className="anime-card-link" to={`/anime/${anime.id}`}>
        <div className="anime-card-cover">
          {anime.cover ? (
            <img src={anime.cover} alt="" loading="lazy" referrerPolicy="no-referrer" />
          ) : (
            <span className="anime-card-nocover" aria-hidden="true">
              {anime.title[0]?.toUpperCase()}
            </span>
          )}

          <div className="anime-card-bubble" aria-hidden="true">
            <strong>{episodesLabel(anime)}</strong>
            {anime.description && <span>{shorten(anime.description)}</span>}
          </div>
        </div>
        <h3 className="anime-card-title">{anime.title}</h3>
      </Link>

      <FavoriteDiamond animeId={anime.id} title={anime.title} />
    </article>
  )
}

export default AnimeCard
