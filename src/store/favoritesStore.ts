import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Favorite anime, saved in this browser only (localStorage), same style as progressionStore.
// We save just the anime ids (newest first), never the anime data itself.
//
// Upgrading later: to sync favorites across devices, this is the only file that changes.
// The same list of ids is stored in a Supabase table instead, and pages keep using the same hook.

export interface FavoriteItem {
  id: number
  addedAt: number
}

interface FavoritesState {
  favorites: FavoriteItem[] // newest first
  toggleFavorite: (id: number) => void
}

export const useAnimeFavorites = create<FavoritesState>()(
  persist(
    (set) => ({
      favorites: [],

      toggleFavorite: (id) =>
        set((state) => {
          const alreadyFavorite = state.favorites.some((item) => item.id === id)
          return {
            favorites: alreadyFavorite
              ? state.favorites.filter((item) => item.id !== id)
              : [{ id, addedAt: Date.now() }, ...state.favorites],
          }
        }),
    }),
    {
      name: 'ellen-anime-favorites',
      version: 1,
      partialize: (state) => ({ favorites: state.favorites }),
      // localStorage can be edited by anyone, so only accept well-formed entries.
      merge: (persisted, current) => {
        const savedList = (persisted as { favorites?: unknown } | null | undefined)?.favorites
        const saved: unknown[] = Array.isArray(savedList) ? savedList : []
        const seen = new Set<number>()
        const favorites: FavoriteItem[] = []
        for (const item of saved) {
          const entry = item as { id?: unknown; addedAt?: unknown } | null
          const id = entry?.id
          if (typeof id === 'number' && Number.isInteger(id) && !seen.has(id)) {
            seen.add(id)
            const addedAt = entry?.addedAt
            favorites.push({ id, addedAt: typeof addedAt === 'number' && Number.isFinite(addedAt) ? addedAt : 0 })
          }
        }
        return { ...current, favorites }
      },
    }
  )
)
