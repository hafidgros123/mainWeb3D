import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { episodesLabel, getAnimeById, getSeasonsFor, statusLabel } from '../../animeData/animeSource'
import GameComments from '../games/GameComments' // the same comment box as the game pages
import FavoriteDiamond from './FavoriteDiamond'
import TurnPlaceholder from '../../shared/TurnPlaceholder'
import '../games/gamepage.css' // holds the comment styles (loaded once, shared with the game pages)
import './AnimeUpdatesPage.css'

// Info page for one anime. Latest episode and manga chapter are added in a later step.
function AnimeInfoPage() {
  const { id } = useParams()
  const animeId = /^\d+$/.test(id ?? '') ? Number(id) : null
  const [state, setState] = useState({ status: 'loading', anime: null, seasons: [] }) // 'loading' | 'ready' | 'missing' | 'error'

  useEffect(() => {
    let cancelled = false

    if (animeId === null) {
      setState({ status: 'missing', anime: null, seasons: [] })
      return undefined
    }

    setState({ status: 'loading', anime: null, seasons: [] })
    getAnimeById(animeId)
      .then(async (anime) => {
        if (!anime) {
          if (!cancelled) setState({ status: 'missing', anime: null, seasons: [] })
          return
        }
        const seasons = await getSeasonsFor(anime)
        if (!cancelled) setState({ status: 'ready', anime, seasons })
      })
      .catch((error) => {
        console.error(error)
        if (!cancelled) setState({ status: 'error', anime: null, seasons: [] })
      })

    return () => {
      cancelled = true
    }
  }, [animeId])

  const { status, anime, seasons } = state

  return (
    <main className="anime-updates-page anime-info-page">
      <Link className="anime-back-link" to="/anime">
        <span aria-hidden="true">&#8592;</span> Anime list
      </Link>

      {status === 'loading' && (
        <TurnPlaceholder>
          <span className="loading-phrase">Details loading... please wait a bit more ....or get a better cpu</span>
        </TurnPlaceholder>
      )}
      {status === 'error' && (
        <TurnPlaceholder message="Error loading anime details ...? ayo how did you manage to break it " />
      )}
      {status === 'missing' && (
        <TurnPlaceholder message="Anime not found ...? ayo try searching for a real thing this time chud " />
      )}

      {status === 'ready' && (
        <>
          <h1>{anime.title}</h1>
          {anime.titleAlt && <p className="anime-info-alt">{anime.titleAlt}</p>}

          {seasons.length > 1 && (
            <div className="anime-season-tabs" role="tablist" aria-label="Seasons">
              {seasons.map((season) => (
                <Link
                  key={season.id}
                  to={`/anime/${season.id}`}
                  className={`anime-season-tab${season.id === anime.id ? ' is-active' : ''}`}
                  aria-current={season.id === anime.id ? 'page' : undefined}
                >
                  {season.title}
                  {season.year ? ` (${season.year})` : ''}
                </Link>
              ))}
            </div>
          )}

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