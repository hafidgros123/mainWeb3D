// The ONLY file that knows where the anime data comes from.
// Today it reads the file public/data/anime.json (made by scripts/update-anime-data.mjs).
// When the GitHub bot exists it updates that same file, so nothing in here has to change.

const DATA_URL = `${import.meta.env.BASE_URL}data/anime.json`

export const STATUS_LABELS = {
  FINISHED: 'Finished',
  RELEASING: 'Ongoing',
  NOT_YET_RELEASED: 'Not yet released',
  CANCELLED: 'Cancelled',
  HIATUS: 'On hiatus',
}

export function statusLabel(status) {
  return STATUS_LABELS[status] ?? 'Unknown'
}

export function episodesLabel(anime) {
  if (Number.isInteger(anime.episodes) && anime.episodes > 0) {
    return anime.episodes === 1 ? '1 episode' : `${anime.episodes} episodes`
  }
  return anime.status === 'RELEASING' ? 'Ongoing' : 'Episodes unknown'
}

// The file is ours, but we still check every field, so a damaged file can never break the page.
function normalize(raw) {
  if (!raw || !Number.isInteger(raw.id) || typeof raw.title !== 'string' || !raw.title) return null
  return {
    id: raw.id,
    title: raw.title,
    titleAlt: typeof raw.titleAlt === 'string' ? raw.titleAlt : null,
    cover: typeof raw.cover === 'string' && raw.cover.startsWith('https://') ? raw.cover : null,
    description: typeof raw.description === 'string' ? raw.description : '',
    episodes: Number.isInteger(raw.episodes) ? raw.episodes : null,
    status: typeof raw.status === 'string' ? raw.status : null,
    format: typeof raw.format === 'string' ? raw.format : null,
    year: Number.isInteger(raw.year) ? raw.year : null,
    genres: Array.isArray(raw.genres) ? raw.genres.filter((genre) => typeof genre === 'string') : [],
    score: Number.isFinite(raw.score) ? raw.score : null,
    popularity: Number.isFinite(raw.popularity) ? raw.popularity : 0,
    // Every season/part of the same show shares the same seasonGroupId (the
    // smallest anime id among them), so the catalog can show one card per show.
    seasonGroupId: Number.isInteger(raw.seasonGroupId) ? raw.seasonGroupId : raw.id,
    // filled by the bot later; the info page will read them
    latestEpisode: raw.latestEpisode ?? null,
    lastAiredAt: raw.lastAiredAt ?? null,
    nextEpisode: raw.nextEpisode ?? null,
    nextAiringAt: raw.nextAiringAt ?? null,
    manga: raw.manga ?? null,
  }
}

let loading = null

// Resolves to { updatedAt, anime } with the anime sorted from most to least popular.
export function loadAnimeData() {
  if (!loading) {
    loading = fetch(DATA_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`anime.json answered ${response.status}`)
        return response.json() // fails if the dev server answered with a web page instead of the file
      })
      .then((data) => {
        if (!data || !Array.isArray(data.anime)) throw new Error('anime.json has an unexpected format')
        return {
          updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : null,
          anime: data.anime.map(normalize).filter(Boolean).sort((a, b) => b.popularity - a.popularity),
        }
      })
      .catch((error) => {
        loading = null // so "Try again" really tries again
        throw error
      })
  }
  return loading
}

// Collapses every season/part that shares a seasonGroupId into one card: the
// most popular season represents the group, and `seasonCount` says how many
// there are. Used for the main catalog grid so "Re:Zero", "Re:Zero Season 2
// Part 1" and "...Part 2" show up as a single "Re:Zero" card instead of three.
export function groupAnimeSeasons(anime) {
  const groups = new Map()
  for (const item of anime) {
    const key = item.seasonGroupId
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(item)
  }

  const result = []
  for (const members of groups.values()) {
    members.sort((a, b) => (a.year ?? 0) - (b.year ?? 0) || a.id - b.id)
    const representative = members.reduce(
      (best, item) => (item.popularity > best.popularity ? item : best),
      members[0],
    )
    result.push({ ...representative, seasonCount: members.length, seasons: members })
  }

  return result.sort((a, b) => b.popularity - a.popularity)
}

export async function getAnimeById(id) {
  const { anime } = await loadAnimeData()
  return anime.find((item) => item.id === id) ?? null
}

// Every season/part that shares `anime`'s seasonGroupId, oldest first — used
// to show a "Seasons" row on the info page so Part 1/Part 2/etc. are all reachable.
export async function getSeasonsFor(anime) {
  const { anime: all } = await loadAnimeData()
  return all
    .filter((item) => item.seasonGroupId === anime.seasonGroupId)
    .sort((a, b) => (a.year ?? 0) - (b.year ?? 0) || a.id - b.id)
}