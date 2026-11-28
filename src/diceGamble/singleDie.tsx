import { faceUrl } from '../lib/DiceImages'

interface SingleDieProps {
  value?: number // 0 = blank face
  rolling?: boolean
  throwSrc?: string // the throw animation picture shown while rolling
  className?: string
}

// One die slot. value 0 = blank face. While rolling it shows the throw animation.
function SingleDie({ value = 0, rolling = false, throwSrc = '', className = '' }: SingleDieProps) {
  const src = rolling && throwSrc ? throwSrc : faceUrl(value)
  const label = rolling ? 'Die rolling' : value ? `Die showing ${value}` : 'Empty die'

  return <img className={`single-die ${className}`} src={src} alt={label} draggable="false" />
}

export default SingleDie
