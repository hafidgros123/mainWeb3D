import { create } from 'zustand'
import { isAnimationName, type AnimationName } from '../three/animations'

interface SceneState {
  pendingAnimation: AnimationName | null
  triggerAnimation: (name: string) => void
  clearAnimation: () => void
}

export const useSceneStore = create<SceneState>()((set) => ({
  pendingAnimation: null,
  triggerAnimation: (name) => {
    if (isAnimationName(name)) set({ pendingAnimation: name })
  },
  clearAnimation: () => set({ pendingAnimation: null }),
}))
