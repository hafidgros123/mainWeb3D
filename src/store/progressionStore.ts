import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { gameDefinitions } from '../gamesData/gameDefinitions'

interface ProgressionState {
  completedGames: string[]
  sessionUnlocked: boolean // only until the tab is closed (not saved)
  secretThemeUnlocked: boolean
  completeGame: (gameId: string) => void
  unlockForSession: () => void
  unlockSecretTheme: () => void
}

export const selectThreeDUnlocked = (state: ProgressionState): boolean =>
  state.sessionUnlocked || gameDefinitions.some((game) => state.completedGames.includes(game.id))

export const selectSecretThemeUnlocked = (state: ProgressionState): boolean =>
  state.secretThemeUnlocked || gameDefinitions.every((game) => state.completedGames.includes(game.id))

export const useProgression = create<ProgressionState>()(
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
