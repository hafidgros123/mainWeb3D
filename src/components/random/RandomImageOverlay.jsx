import { useEffect, useLayoutEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

const cornerFolders = [
  ['top left', 'top-left'],
  ['top right', 'top-right'],
  ['bottom left', 'bottom-left'],
]
const imageModules = import.meta.glob(
  '../../assets/random/*/*.{avif,gif,jpeg,jpg,png,svg,webp}',
  { eager: true, import: 'default' },
)

const imagesByCorner = Object.fromEntries(
  cornerFolders.map(([folder, corner]) => [
    corner,
    Object.entries(imageModules)
      .filter(([path]) => path.split('/').slice(-2, -1)[0] === folder)
      .sort(([firstPath], [secondPath]) => firstPath.localeCompare(secondPath))
      .map(([path, src]) => ({ src, isRem: path.toLowerCase().endsWith('/rem.png') })),
  ]),
)
const corners = cornerFolders.map(([, corner]) => corner)
const MAX_IMAGES_PER_CORNER = 10

const RANDOM_IMAGE_KEY = 'random-image-overlay-last-change'
const CORNER_QUEUE_KEY = `${RANDOM_IMAGE_KEY}-corner-queue`
const LAST_CORNER_KEY = `${RANDOM_IMAGE_KEY}-last-corner`

function shuffleCorners(availableCorners) {
  const shuffledCorners = [...availableCorners]

  for (let index = shuffledCorners.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffledCorners[index], shuffledCorners[randomIndex]] = [
      shuffledCorners[randomIndex],
      shuffledCorners[index],
    ]
  }

  const lastCorner = window.localStorage.getItem(LAST_CORNER_KEY)
  if (shuffledCorners.length > 1 && shuffledCorners[0] === lastCorner) {
    ;[shuffledCorners[0], shuffledCorners[1]] = [shuffledCorners[1], shuffledCorners[0]]
  }

  return shuffledCorners
}

function getNextCorner(availableCorners) {
  let cornerQueue
  try {
    cornerQueue = JSON.parse(window.localStorage.getItem(CORNER_QUEUE_KEY) || '[]')
  } catch {
    cornerQueue = []
  }

  if (!Array.isArray(cornerQueue)) {
    cornerQueue = []
  }

  cornerQueue = [...new Set(cornerQueue.filter((corner) => availableCorners.includes(corner)))]
  if (cornerQueue.length === 0) {
    cornerQueue = shuffleCorners(availableCorners)
  }

  const [nextCorner, ...remainingCorners] = cornerQueue
  window.localStorage.setItem(CORNER_QUEUE_KEY, JSON.stringify(remainingCorners))
  window.localStorage.setItem(LAST_CORNER_KEY, nextCorner)
  return nextCorner
}

function createRandomImage() {
  const availableCorners = corners.filter(
    (corner) => imagesByCorner[corner].length > 0,
  )
  const corner = getNextCorner(availableCorners)
  const cornerImages = imagesByCorner[corner].slice(0, MAX_IMAGES_PER_CORNER)
  const indexStorageKey = `${RANDOM_IMAGE_KEY}-${corner}-index`
  const storedIndex = window.localStorage.getItem(indexStorageKey)
  const previousIndex = storedIndex === null ? -1 : Number(storedIndex)
  const nextIndex = Number.isInteger(previousIndex)
    && previousIndex >= -1
    && previousIndex < cornerImages.length
    ? (previousIndex + 1) % cornerImages.length
    : 0

  window.localStorage.setItem(indexStorageKey, String(nextIndex))

  return {
    ...cornerImages[nextIndex],
    corner,
  }
}

function RandomImageOverlay() {
  const location = useLocation()
  const [activeImage, setActiveImage] = useState(null)

  useEffect(() => {
    Object.values(imagesByCorner)
      .flatMap((images) => images.slice(0, MAX_IMAGES_PER_CORNER))
      .forEach(({ src }) => {
      const image = new window.Image()
      image.src = src
      if (typeof image.decode === 'function') {
        image.decode().catch(() => {})
      }
    })
  }, [])

  useLayoutEffect(() => {
    const nextImage = createRandomImage()
    setActiveImage(nextImage)
  }, [location.pathname])

  if (!activeImage) {
    return null
  }

  return (
    <div className="random-image-layer" aria-hidden="true">
      <img
        key={`${activeImage.corner}-${activeImage.src}`}
        src={activeImage.src}
        alt=""
        className={`background-image background-image--${activeImage.corner}${activeImage.isRem ? ' background-image--rem' : ''}`}
        draggable="false"
      />
    </div>
  )
}

export default RandomImageOverlay
