import { useEffect, useMemo, useState } from 'react'
import { groupAnimeSeasons, loadAnimeData } from '../../animeData/animeSource'
import { useAnimeFavorites } from '../../store/favoritesStore'
import TurnPlaceholder from '../../shared/TurnPlaceholder'
import AnimeCard from './AnimeCard'
import './AnimeUpdatesPage.css'

const PAGE_SIZE = 20

function AnimeUpdatesPage() {
  const [data, setData] = useState({ status: 'loading', anime: [] }) // 'loading' | 'ready' | 'error'
  const [attempt, setAttempt] = useState(0)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [query, setQuery] = useState('')
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

  // One card per show: every season/part of the same show (e.g. Re:Zero,
  // Re:Zero Season 2 Part 1, Part 2) collapses into a single entry here.
  const groupedAnime = useMemo(() => groupAnimeSeasons(data.anime), [data.anime])

  // Filtered by the search box, matching the main title or the romaji/alt title.
  const filteredAnime = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return groupedAnime
    return groupedAnime.filter(
      (anime) =>
        anime.title.toLowerCase().includes(q) ||
        (anime.titleAlt && anime.titleAlt.toLowerCase().includes(q)),
    )
  }, [groupedAnime, query])

  const shown = filteredAnime.slice(0, visibleCount)

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

        {data.status === 'loading' && (
          <TurnPlaceholder message="[WRITE FUNNY MESSAGE HERE: favorites are loading]" />
        )}
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

      <div className="anime-search">
        <svg className="anime-search-icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="search"
          className="anime-search-input"
          placeholder="Search anime..."
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setVisibleCount(PAGE_SIZE) // reset paging whenever the search changes
          }}
          aria-label="Search anime"
        />
      </div>

      <section className="anime-box anime-list-area" aria-labelledby="anime-list-title">
        <h2 id="anime-list-title" className="anime-box-title">
          Anime List
        </h2>

        {data.status === 'loading' && (
          <TurnPlaceholder message="[WRITE FUNNY MESSAGE HERE: anime catalog is loading]" />
        )}

        {data.status === 'error' && (
          <div role="alert">
            <TurnPlaceholder message="[WRITE FUNNY MESSAGE HERE: anime catalog failed to load]" />
            <button type="button" className="anime-button" onClick={() => setAttempt((value) => value + 1)}>
              Try again
            </button>
          </div>
        )}

        {data.status === 'ready' && filteredAnime.length === 0 && (
          <p className="anime-note">No anime matches "{query}".</p>
        )}

        {data.status === 'ready' && filteredAnime.length > 0 && (
          <>
            <div className="anime-grid">
              {shown.map((anime) => (
                <AnimeCard key={anime.id} anime={anime} />
              ))}
            </div>

            <div className="anime-list-footer">
              <span className="anime-note">
                Showing {shown.length} of {filteredAnime.length}, most popular first
              </span>
              {shown.length < filteredAnime.length && (
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