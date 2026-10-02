import { create } from 'zustand'
import { ANIMATION_NAMES } from '../three/animations'

export const useSceneStore = create((set) => ({
  pendingAnimation: null,
  triggerAnimation: (name) => {
    if (ANIMATION_NAMES.includes(name)) set({ pendingAnimation: name })
  },
  clearAnimation: () => set({ pendingAnimation: null }),
}))
