import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Favorite anime, saved in this browser only (localStorage), same style as progressionStore.
// We save just the anime ids (newest first), never the anime data itself.
//
// Upgrading later: to sync favorites across devices, this is the only file that changes.
// The same list of ids is stored in a Supabase table instead, and pages keep using the same hook.

export const useAnimeFavorites = create(
  persist(
    (set) => ({
      favorites: [], // [{ id, addedAt }], newest first

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
        const saved = Array.isArray(persisted?.favorites) ? persisted.favorites : []
        const seen = new Set()
        const favorites = []
        for (const item of saved) {
          if (Number.isInteger(item?.id) && !seen.has(item.id)) {
            seen.add(item.id)
            favorites.push({ id: item.id, addedAt: Number.isFinite(item.addedAt) ? item.addedAt : 0 })
          }
        }
        return { ...current, favorites }
      },
    }
  )
)
