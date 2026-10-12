import { useState } from 'react'

const BACKGROUNDS = {
  crimson: '/backgrounds/maria.webp',
  blue: '/backgrounds/ranni.webp',
  'light-blue': '/backgrounds/mik.webp',
  gold: '/backgrounds/ma.webp',
  jade: '/backgrounds/wtce.webp',
  secret: '/backgrounds/blood.webp',
}

// 'plain' = no picture (crimson theme on pages that only use the solid colour)
const LAYERS = [...Object.keys(BACKGROUNDS), 'plain']

export default function ThemeBackground({ theme, showCrimson }) {
  const current = theme === 'crimson' && !showCrimson ? 'plain' : theme

  // remember the previous layer so it stays visible underneath while the new one fades in
  const [shown, setShown] = useState({ current, prev: null })
  if (shown.current !== current) setShown({ current, prev: shown.current })

  return (
    <div className="theme-bg" aria-hidden="true">
      {LAYERS.map((name) => {
        const state = name === shown.current ? ' is-current' : name === shown.prev ? ' is-prev' : ''
        return BACKGROUNDS[name] ? (
          <img
            key={name}
            src={BACKGROUNDS[name]}
            alt=""
            decoding="async"
            className={`theme-bg__layer${state}`}
          />
        ) : (
          <div key={name} className={`theme-bg__layer theme-bg__plain${state}`} />
        )
      })}
    </div>
  )
}
