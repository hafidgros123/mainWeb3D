import { useAnimeFavorites } from '../../store/favoritesStore'

// The diamond button: outlined = not a favorite, filled = favorite. Pressing it only toggles that.
function FavoriteDiamond({ animeId, title }) {
  const isFavorite = useAnimeFavorites((state) => state.favorites.some((item) => item.id === animeId))
  const toggleFavorite = useAnimeFavorites((state) => state.toggleFavorite)

  return (
    <button
      type="button"
      className={`anime-diamond${isFavorite ? ' is-favorite' : ''}`}
      aria-pressed={isFavorite}
      aria-label={`Favorite ${title}`}
      title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      onClick={() => toggleFavorite(animeId)}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 2.5 21.5 12 12 21.5 2.5 12Z" />
      </svg>
    </button>
  )
}

export default FavoriteDiamond
