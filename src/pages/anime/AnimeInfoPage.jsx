import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { episodesLabel, getAnimeById, statusLabel } from '../../animeData/animeSource'
import GameComments from '../games/GameComments' // the same comment box as the game pages
import FavoriteDiamond from './FavoriteDiamond'
import '../games/gamepage.css' // holds the comment styles (loaded once, shared with the game pages)
import './AnimeUpdatesPage.css'

// Info page for one anime. Latest episode and manga chapter are added in a later step.
function AnimeInfoPage() {
  const { id } = useParams()
  const animeId = /^\d+$/.test(id ?? '') ? Number(id) : null
  const [state, setState] = useState({ status: 'loading', anime: null }) // 'loading' | 'ready' | 'missing' | 'error'

  useEffect(() => {
    let cancelled = false

    if (animeId === null) {
      setState({ status: 'missing', anime: null })
      return undefined
    }

    setState({ status: 'loading', anime: null })
    getAnimeById(animeId)
      .then((anime) => {
        if (!cancelled) setState(anime ? { status: 'ready', anime } : { status: 'missing', anime: null })
      })
      .catch((error) => {
        console.error(error)
        if (!cancelled) setState({ status: 'error', anime: null })
      })

    return () => {
      cancelled = true
    }
  }, [animeId])

  const { status, anime } = state

  return (
    <main className="anime-updates-page anime-info-page">
      <Link className="anime-back-link" to="/anime">
        <span aria-hidden="true">&#8592;</span> Anime list
      </Link>

      {status === 'loading' && <p className="anime-note">Loading...</p>}
      {status === 'error' && <p className="anime-note">This anime could not be loaded right now.</p>}
      {status === 'missing' && <p className="anime-note">Anime not found.</p>}

      {status === 'ready' && (
        <>
          <h1>{anime.title}</h1>
          {anime.titleAlt && <p className="anime-info-alt">{anime.titleAlt}</p>}

          <section className="anime-box anime-info-box" aria-label={`About ${anime.title}`}>
            <div className="anime-info-layout">
              <div className="anime-info-cover">
                {anime.cover ? (
                  <img src={anime.cover} alt={`Cover of ${anime.title}`} referrerPolicy="no-referrer" />
                ) : (
                  <span className="anime-card-nocover" aria-hidden="true">
                    {anime.title[0]?.toUpperCase()}
                  </span>
                )}
                <FavoriteDiamond animeId={anime.id} title={anime.title} />
              </div>

              <div className="anime-info-details">
                <dl className="anime-facts">
                  <div>
                    <dt>Status</dt>
                    <dd>{statusLabel(anime.status)}</dd>
                  </div>
                  <div>
                    <dt>Episodes</dt>
                    <dd>{episodesLabel(anime)}</dd>
                  </div>
                  {anime.format && (
                    <div>
                      <dt>Format</dt>
                      <dd>{anime.format.replace(/_/g, ' ')}</dd>
                    </div>
                  )}
                  {anime.year && (
                    <div>
                      <dt>Year</dt>
                      <dd>{anime.year}</dd>
                    </div>
                  )}
                  {anime.score !== null && (
                    <div>
                      <dt>Score</dt>
                      <dd>{(anime.score / 10).toFixed(1)} / 10</dd>
                    </div>
                  )}
                </dl>

                {anime.genres.length > 0 && (
                  <ul className="anime-genres" aria-label="Genres">
                    {anime.genres.map((genre) => (
                      <li key={genre}>{genre}</li>
                    ))}
                  </ul>
                )}

                {anime.description && <p className="anime-info-description">{anime.description}</p>}
              </div>
            </div>
          </section>

          {/* "gameId" is just the name of the comment thread; an anime uses "anime-<id>" */}
          <GameComments gameId={`anime-${anime.id}`} />
        </>
      )}
    </main>
  )
}

export default AnimeInfoPage
