import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { gameDefinitions } from '../gamesData/gameDefinitions'

export const selectThreeDUnlocked = (state) =>
  state.sessionUnlocked || gameDefinitions.some((game) => state.completedGames.includes(game.id))

export const selectSecretThemeUnlocked = (state) =>
  state.secretThemeUnlocked || gameDefinitions.every((game) => state.completedGames.includes(game.id))

export const useProgression = create(
  persist(
    (set) => ({
      completedGames: [],
      sessionUnlocked: false,
      secretThemeUnlocked: false,
      completeGame: (gameId) =>
        set((state) => {
          const completedGames = state.completedGames.includes(gameId)
            ? state.completedGames
            : [...state.completedGames, gameId]

          return { completedGames }
        }),
      unlockForSession: () => set({ sessionUnlocked: true }),
      unlockSecretTheme: () => set({ secretThemeUnlocked: true }),
    }),
    {
      name: 'ellen-progression',
      partialize: (state) => ({ completedGames: state.completedGames, secretThemeUnlocked: state.secretThemeUnlocked }),
    },
  ),
)
