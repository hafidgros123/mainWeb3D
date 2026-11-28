// Keep these names identical to the animation clips inside the future character model.
export const ANIMATION_NAMES = ['idle', 'dance', 'wave', 'jump', 'sit'] as const

export type AnimationName = (typeof ANIMATION_NAMES)[number]

export function isAnimationName(name: string): name is AnimationName {
  return (ANIMATION_NAMES as readonly string[]).includes(name)
}
