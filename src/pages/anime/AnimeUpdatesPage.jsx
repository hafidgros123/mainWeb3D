import { useEffect, useMemo, useState } from 'react'
import { loadAnimeData } from '../../animeData/animeSource'
import { useAnimeFavorites } from '../../store/favoritesStore'
import AnimeCard from './AnimeCard'
import './AnimeUpdatesPage.css'

const PAGE_SIZE = 20

function AnimeUpdatesPage() {
  const [data, setData] = useState({ status: 'loading', anime: [] }) // 'loading' | 'ready' | 'error'
  const [attempt, setAttempt] = useState(0)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const favorites = useAnimeFavorites((state) => state.favorites)

  useEffect(() => {
    let cancelled = false
    setData({ status: 'loading', anime: [] })

    loadAnimeData()
      .then(({ anime }) => {
        if (!cancelled) setData({ status: 'ready', anime })
      })
      .catch((error) => {
        console.error(error)
        if (!cancelled) setData({ status: 'error', anime: [] })
      })

    return () => {
      cancelled = true
    }
  }, [attempt])

  // The favorites strip: newest favorite first (ids the data file does not know are skipped).
  const favoriteAnime = useMemo(() => {
    const byId = new Map(data.anime.map((anime) => [anime.id, anime]))
    return favorites.map((item) => byId.get(item.id)).filter(Boolean)
  }, [favorites, data.anime])

  const shown = data.anime.slice(0, visibleCount)

  return (
    <main className="anime-updates-page">
      <p className="eyebrow">Episode releases and anime catalog</p>
      <h1>Anime Updates</h1>
      <p className="anime-updates-intro">
        See the newest episode releases and browse the anime catalog. Sign-in will be required to comment.
      </p>

      <section className="anime-box anime-favorites" aria-labelledby="anime-favorites-title">
        <h2 id="anime-favorites-title" className="anime-box-title">
          Favorites
        </h2>

        {data.status === 'loading' && <p className="anime-note">Loading...</p>}
        {data.status === 'ready' && favoriteAnime.length === 0 && (
          <p className="anime-note">Press the diamond on any anime to pin it here.</p>
        )}
        {favoriteAnime.length > 0 && (
          <div className="anime-strip">
            {favoriteAnime.map((anime) => (
              <AnimeCard key={anime.id} anime={anime} />
            ))}
          </div>
        )}
      </section>

      <section className="anime-box anime-list-area" aria-labelledby="anime-list-title">
        <h2 id="anime-list-title" className="anime-box-title">
          Anime List
        </h2>

        {data.status === 'loading' && <p className="anime-note">Loading the anime catalog...</p>}

        {data.status === 'error' && (
          <div role="alert">
            <p className="anime-note">The anime list could not be loaded.</p>
            <button type="button" className="anime-button" onClick={() => setAttempt((value) => value + 1)}>
              Try again
            </button>
          </div>
        )}

        {data.status === 'ready' && (
          <>
            <div className="anime-grid">
              {shown.map((anime) => (
                <AnimeCard key={anime.id} anime={anime} />
              ))}
            </div>

            <div className="anime-list-footer">
              <span className="anime-note">
                Showing {shown.length} of {data.anime.length}, most popular first
              </span>
              {shown.length < data.anime.length && (
                <button
                  type="button"
                  className="anime-button"
                  onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                >
                  Load more
                </button>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  )
}

export default AnimeUpdatesPage
