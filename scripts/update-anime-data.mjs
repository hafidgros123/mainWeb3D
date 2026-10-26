// Fills public/data/anime.json with the most popular anime from AniList.
//
// Run it from the project root (the folder that contains package.json):
//
//     node scripts/update-anime-data.mjs
//
// - It needs no API key and no extra packages (Node 18 or newer).
// - It asks AniList for the top 200 most popular non-adult anime (4 requests, about 10 seconds).
// - It never deletes anime it saved before, so a favorite can never disappear from the site.
// - If anything fails, your existing anime.json is left untouched.
//
// Later, a GitHub Action will run this same script every few days.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const API_URL = 'https://graphql.anilist.co'
const HOW_MANY = 200 // how many of the most popular anime to fetch
const PER_PAGE = 50 // AniList allows at most 50 per request
const PAUSE_MS = 2500 // pause between requests (AniList is currently limited to ~30 per minute)
const MAX_TRIES = 5

// Optional: pass another output path as the first argument (used for testing).
const OUT_FILE = process.argv[2]
  ? path.resolve(process.argv[2])
  : fileURLToPath(new URL('../public/data/anime.json', import.meta.url))

const QUERY = `
query ($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { hasNextPage }
    media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) {
      id
      title { romaji english }
      coverImage { large }
      description(asHtml: false)
      episodes
      status
      format
      seasonYear
      genres
      averageScore
      popularity
    }
  }
}`

// Fields the bot will fill in later (latest episode, next episode, source manga chapter).
// They are already part of the shape so the pages never need to change.
const EXTRAS = { latestEpisode: null, lastAiredAt: null, nextEpisode: null, nextAiringAt: null, manga: null }

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// AniList descriptions contain HTML tags and entities. We keep plain text only.
function cleanText(input, maxLength = 1500) {
  if (typeof input !== 'string') return ''
  let text = input
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  text = text.replace(/\s*[(\[](?:Source|Written by)[^)\]]*[)\]]\s*$/i, '').trim()
  if (text.length > maxLength) text = `${text.slice(0, maxLength).trimEnd()}…`
  return text
}

function mapMedia(media) {
  if (!media || !Number.isInteger(media.id)) return null
  const title = media.title?.english || media.title?.romaji
  if (!title) return null
  const romaji = media.title?.romaji
  const cover = media.coverImage?.large

  return {
    id: media.id,
    title: String(title).trim(),
    titleAlt: romaji && romaji !== title ? String(romaji).trim() : null,
    cover: typeof cover === 'string' && cover.startsWith('https://') ? cover : null,
    description: cleanText(media.description),
    episodes: Number.isInteger(media.episodes) ? media.episodes : null,
    status: media.status ?? null,
    format: media.format ?? null,
    year: Number.isInteger(media.seasonYear) ? media.seasonYear : null,
    genres: Array.isArray(media.genres) ? media.genres.filter((genre) => typeof genre === 'string') : [],
    score: Number.isFinite(media.averageScore) ? media.averageScore : null,
    popularity: Number.isFinite(media.popularity) ? media.popularity : 0,
  }
}

async function fetchPage(page) {
  for (let attempt = 1; attempt <= MAX_TRIES; attempt += 1) {
    let response
    try {
      response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query: QUERY, variables: { page, perPage: PER_PAGE } }),
      })
    } catch (error) {
      if (attempt === MAX_TRIES) throw new Error(`Could not reach AniList: ${error.message}`)
      console.log(`  network problem, trying again (${attempt}/${MAX_TRIES})...`)
      await sleep(attempt * 3000)
      continue
    }

    if (response.status === 429) {
      const seconds = Number(response.headers.get('Retry-After')) || 60
      console.log(`  AniList says slow down, waiting ${seconds}s...`)
      await sleep((seconds + 1) * 1000)
      continue
    }

    if (!response.ok) {
      if (attempt === MAX_TRIES) throw new Error(`AniList answered with error ${response.status}`)
      await sleep(attempt * 3000)
      continue
    }

    const json = await response.json()
    if (json.errors?.length) throw new Error(`AniList error: ${json.errors[0].message}`)
    if (!json.data?.Page) throw new Error('AniList sent an answer in an unexpected format')
    return json.data.Page
  }
  throw new Error('AniList kept refusing requests (rate limit). Wait a few minutes and run the script again.')
}

function readExisting() {
  try {
    const data = JSON.parse(fs.readFileSync(OUT_FILE, 'utf8'))
    return Array.isArray(data.anime) ? data.anime : []
  } catch {
    return []
  }
}

async function main() {
  const pages = Math.ceil(HOW_MANY / PER_PAGE)
  const fetched = []

  console.log(`Asking AniList for the top ${HOW_MANY} anime...`)
  for (let page = 1; page <= pages; page += 1) {
    console.log(`  page ${page}/${pages}`)
    const result = await fetchPage(page)
    for (const media of result.media ?? []) {
      const anime = mapMedia(media)
      if (anime) fetched.push(anime)
    }
    if (!result.pageInfo?.hasNextPage) break
    if (page < pages) await sleep(PAUSE_MS)
  }

  if (fetched.length === 0) throw new Error('AniList returned no anime, so nothing was saved.')

  // Merge with what was saved before: new data wins, old entries are kept.
  const byId = new Map()
  for (const old of readExisting()) {
    if (old && Number.isInteger(old.id)) byId.set(old.id, old)
  }
  let added = 0
  for (const anime of fetched) {
    const previous = byId.get(anime.id)
    if (!previous) added += 1
    byId.set(anime.id, previous ? { ...previous, ...anime } : { ...anime, ...EXTRAS })
  }

  const all = [...byId.values()].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))

  // One anime per line, so the file stays readable and git changes stay small.
  const text = `{"updatedAt":${JSON.stringify(new Date().toISOString())},"anime":[\n${all
    .map((anime) => JSON.stringify(anime))
    .join(',\n')}\n]}\n`

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true })
  const temporary = `${OUT_FILE}.tmp`
  fs.writeFileSync(temporary, text)
  fs.renameSync(temporary, OUT_FILE) // swap in one step, so the file is never half-written

  const kept = all.length - new Set(fetched.map((anime) => anime.id)).size
  console.log(`\nDone: ${all.length} anime saved (${added} new, ${kept} kept from an earlier run).`)
  console.log(`File: ${OUT_FILE}`)
}

main().catch((error) => {
  console.error(`\nFailed: ${error.message}`)
  console.error('Your existing anime.json was not changed.')
  process.exit(1)
})
