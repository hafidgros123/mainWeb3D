import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

const BACKGROUNDS = {
  crimson: {
    default: '/backgrounds/maria.webp',
    route: '/backgrounds/maria2.webp',
  },

  blue: {
    default: '/backgrounds/ranni.webp',
    route: '/backgrounds/ranni2.webp',
  },

  'light-blue': {
    default: '/backgrounds/cyber.webp',
    route: '/backgrounds/cyber2.webp',
  },

  gold: {
    default: '/backgrounds/ma.webp',
    route: '/backgrounds/PUT-GOLD-3D-ANIME-IMAGE-HERE.webp',
  },

  jade: {
    default: '/backgrounds/wtce.webp',
    route: '/backgrounds/witcher2.webp',
  },

  secret: {
    default: '/backgrounds/blood.webp',
    route: '/backgrounds/ma2.webp',
  },
}

const LAYERS = Object.entries(BACKGROUNDS).flatMap(([theme, images]) => [
  { id: `${theme}-default`, src: images.default },
  { id: `${theme}-route`, src: images.route },
])

function isAnimeOr3DRoute(pathname) {
  return (
    pathname === '/3d' ||
    pathname.startsWith('/3d/') ||
    pathname === '/anime' ||
    pathname.startsWith('/anime/') ||
    pathname === '/games' ||
    pathname.startsWith('/games/')
  )
}

export default function ThemeBackground({ theme }) {
  const { pathname } = useLocation()

  const selectedTheme = BACKGROUNDS[theme] ? theme : 'crimson'
  const pageVersion = isAnimeOr3DRoute(pathname) ? 'route' : 'default'
  const current = `${selectedTheme}-${pageVersion}`

  const [shown, setShown] = useState({
    current,
    prev: null,
  })

  useEffect(() => {
    setShown((previous) => {
      if (previous.current === current) return previous

      return {
        current,
        prev: previous.current,
      }
    })
  }, [current])

  return (
    <div className="theme-bg" aria-hidden="true">
      {LAYERS.map((layer) => {
        const state =
          layer.id === shown.current
            ? ' is-current'
            : layer.id === shown.prev
              ? ' is-prev'
              : ''

        return (
          <img
            key={layer.id}
            src={layer.src}
            alt=""
            decoding="async"
            className={`theme-bg__layer${state}`}
          />
        )
      })}
    </div>
  )
}