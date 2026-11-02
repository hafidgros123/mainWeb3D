// Fills/refreshes public/data/anime.json from AniList.
//
// Run it from the project root (the folder that contains package.json):
//
//     node scripts/update-anime-data.mjs                 → full refresh: catalog + seasons + episodes
//     node scripts/update-anime-data.mjs --episodes-only  → fast refresh: only latest/next episode info
//
// - It needs no API key and no extra packages (Node 18 or newer).
// - Full refresh: asks AniList for the top 200 most popular non-adult anime, then
//   follows prequel/sequel relations to pull in any season that's part of the same
//   show but wasn't popular enough to be in that top 200 on its own (a new Season 3/4,
//   say), then refreshes episode info for whatever is currently RELEASING.
// - --episodes-only: skips all of that and only updates latestEpisode / lastAiredAt /
//   nextEpisode / nextAiringAt for anime already marked RELEASING in the existing file.
//   Much cheaper, so it's the one to run often.
// - It never deletes anime it saved before, so a favorite can never disappear from the site.
// - If anything fails, your existing anime.json is left untouched.
//
// Suggested schedule once this runs via a GitHub Action:
//   - full refresh: every few days          (titles/covers/descriptions rarely change)
//   - --episodes-only: every few hours      (episodes air daily)

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const API_URL = 'https://graphql.anilist.co'
const HOW_MANY = 200 // how many of the most popular anime to fetch, full refresh only
const PER_PAGE = 50 // AniList allows at most 50 per request
const PAUSE_MS = 2500 // pause between requests (AniList is currently limited to ~30 per minute)
const MAX_TRIES = 5
const MAX_SEASON_FILL_ROUNDS = 6 // safety cap on the relation-following loop below

const episodesOnly = process.argv.includes('--episodes-only')
const outPathArg = process.argv.slice(2).find((arg) => !arg.startsWith('--'))
const OUT_FILE = outPathArg
  ? path.resolve(outPathArg)
  : fileURLToPath(new URL('../public/data/anime.json', import.meta.url))

const MEDIA_FIELDS = `
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
  relations {
    edges {
      relationType
      node { id type }
    }
  }
`

const POPULAR_QUERY = `
query ($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { hasNextPage }
    media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) {
      ${MEDIA_FIELDS}
    }
  }
}`

// Fetches specific anime by id, however popular (or not) they are. Used to pull in
// a season that's linked from one we already have but didn't make the popularity cut.
const BY_IDS_QUERY = `
query ($ids: [Int], $perPage: Int) {
  Page(page: 1, perPage: $perPage) {
    media(id_in: $ids, type: ANIME, isAdult: false) {
      ${MEDIA_FIELDS}
    }
  }
}`

// For each requested id: the last aired episode and the next one still to come.
const EPISODE_QUERY = `
query ($ids: [Int], $perPage: Int) {
  Page(page: 1, perPage: $perPage) {
    media(id_in: $ids, type: ANIME) {
      id
      status
      nextAiringEpisode { episode airingAt }
      airingSchedule(notYetAired: false, perPage: 1, sort: EPISODE_DESC) {
        nodes { episode airingAt }
      }
    }
  }
}`

// Fields the bot fills in from the episode query; reserved here so the pages never need to change.
const EXTRAS = { latestEpisode: null, lastAiredAt: null, nextEpisode: null, nextAiringAt: null, manga: null }

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Shared request/retry logic for every query above.
async function graphqlRequest(query, variables) {
  for (let attempt = 1; attempt <= MAX_TRIES; attempt += 1) {
    let response
    try {
      response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query, variables }),
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

// ---------- catalog (titles, covers, descriptions, seasons) ----------

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

// Prequel/sequel anime ids this entry points to directly. Used to group every
// season of the same show under one card instead of listing each part separately.
function seasonLinks(media) {
  const edges = media.relations?.edges ?? []
  return edges
    .filter((edge) => (edge.relationType === 'PREQUEL' || edge.relationType === 'SEQUEL') && edge.node?.type === 'ANIME')
    .map((edge) => edge.node.id)
    .filter((id) => Number.isInteger(id))
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
    seasonLinks: seasonLinks(media),
  }
}

// Union-find: groups every anime with the seasons it's directly linked to, then
// the ones linked to those, and so on, so a 3-part series all lands in one group
// no matter which part AniList calls the "root". The group's id is always the
// smallest anime id in it, so re-running the script gives the same result.
function groupSeasons(byId) {
  const parent = new Map()
  const find = (id) => {
    if (!parent.has(id)) parent.set(id, id)
    let root = id
    while (parent.get(root) !== root) root = parent.get(root)
    while (parent.get(id) !== root) {
      const next = parent.get(id)
      parent.set(id, root)
      id = next
    }
    return root
  }
  const union = (a, b) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(ra, rb)
  }

  for (const anime of byId.values()) {
    find(anime.id)
    for (const relatedId of anime.seasonLinks ?? []) union(anime.id, relatedId)
  }

  const membersByRoot = new Map()
  for (const anime of byId.values()) {
    const root = find(anime.id)
    if (!membersByRoot.has(root)) membersByRoot.set(root, [])
    membersByRoot.get(root).push(anime.id)
  }

  for (const members of membersByRoot.values()) {
    const groupId = Math.min(...members)
    for (const id of members) byId.get(id).seasonGroupId = groupId
  }
}

// Any id a fetched anime points to (as a prequel/sequel) that we don't have yet.
function collectMissingSeasonIds(byId) {
  const missing = new Set()
  for (const anime of byId.values()) {
    for (const relatedId of anime.seasonLinks ?? []) {
      if (!byId.has(relatedId)) missing.add(relatedId)
    }
  }
  return missing
}

// Follows relations outward from what we have until every linked season is present,
// so a show never gets split up just because one of its seasons is newer/less popular
// than the top-200 cutoff. Caps itself at MAX_SEASON_FILL_ROUNDS as a safety net.
async function fillMissingSeasons(byId) {
  let round = 0
  let missing = collectMissingSeasonIds(byId)

  while (missing.size > 0 && round < MAX_SEASON_FILL_ROUNDS) {
    round += 1
    const ids = [...missing]
    console.log(`  following relations: fetching ${ids.length} missing season(s)...`)

    for (let i = 0; i < ids.length; i += PER_PAGE) {
      const chunk = ids.slice(i, i + PER_PAGE)
      const result = await graphqlRequest(BY_IDS_QUERY, { ids: chunk, perPage: chunk.length })
      for (const media of result.media ?? []) {
        const anime = mapMedia(media)
        if (!anime) continue
        const previous = byId.get(anime.id)
        byId.set(anime.id, previous ? { ...previous, ...anime } : { ...anime, ...EXTRAS })
      }
      if (i + PER_PAGE < ids.length) await sleep(PAUSE_MS)
    }

    missing = collectMissingSeasonIds(byId)
  }

  if (missing.size > 0) {
    console.log(`  note: ${missing.size} linked season(s) still missing after ${MAX_SEASON_FILL_ROUNDS} rounds, skipping.`)
  }
}

// ---------- episodes (latest aired / next airing, for RELEASING anime) ----------

// AniList gives airingAt as a Unix timestamp (seconds); the site expects ISO strings.
function toIso(unixSeconds) {
  return Number.isFinite(unixSeconds) ? new Date(unixSeconds * 1000).toISOString() : null
}

async function refreshEpisodeInfo(byId) {
  const releasing = [...byId.values()].filter((anime) => anime.status === 'RELEASING')
  if (releasing.length === 0) {
    console.log('Nothing is currently marked RELEASING, skipping episode info.')
    return
  }

  console.log(`Checking episode info for ${releasing.length} ongoing anime...`)
  for (let i = 0; i < releasing.length; i += PER_PAGE) {
    const chunk = releasing.slice(i, i + PER_PAGE)
    const result = await graphqlRequest(EPISODE_QUERY, { ids: chunk.map((anime) => anime.id), perPage: chunk.length })

    for (const media of result.media ?? []) {
      const entry = byId.get(media.id)
      if (!entry) continue

      const lastAired = media.airingSchedule?.nodes?.[0] ?? null
      const next = media.nextAiringEpisode ?? null

      entry.latestEpisode = Number.isInteger(lastAired?.episode) ? lastAired.episode : entry.latestEpisode
      entry.lastAiredAt = lastAired ? toIso(lastAired.airingAt) : entry.lastAiredAt
      entry.nextEpisode = Number.isInteger(next?.episode) ? next.episode : null
      entry.nextAiringAt = next ? toIso(next.airingAt) : null
    }

    if (i + PER_PAGE < releasing.length) await sleep(PAUSE_MS)
  }
}

// ---------- shared read/write ----------

function readExisting() {
  try {
    const data = JSON.parse(fs.readFileSync(OUT_FILE, 'utf8'))
    return Array.isArray(data.anime) ? data.anime : []
  } catch {
    return []
  }
}

function writeOut(byId) {
  const all = [...byId.values()].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))

  // One anime per line, so the file stays readable and git changes stay small.
  const text = `{"updatedAt":${JSON.stringify(new Date().toISOString())},"anime":[\n${all
    .map((anime) => JSON.stringify(anime))
    .join(',\n')}\n]}\n`

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true })
  const temporary = `${OUT_FILE}.tmp`
  fs.writeFileSync(temporary, text)
  fs.renameSync(temporary, OUT_FILE) // swap in one step, so the file is never half-written

  return all.length
}

// ---------- entry points ----------

async function runFullRefresh() {
  const pages = Math.ceil(HOW_MANY / PER_PAGE)
  const fetched = []

  console.log(`Asking AniList for the top ${HOW_MANY} anime...`)
  for (let page = 1; page <= pages; page += 1) {
    console.log(`  page ${page}/${pages}`)
    const result = await graphqlRequest(POPULAR_QUERY, { page, perPage: PER_PAGE })
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

  await fillMissingSeasons(byId)
  groupSeasons(byId)
  await refreshEpisodeInfo(byId)

  const total = writeOut(byId)
  const kept = total - new Set(fetched.map((anime) => anime.id)).size
  console.log(`\nDone: ${total} anime saved (${added} new, ${kept} kept from an earlier run).`)
  console.log(`File: ${OUT_FILE}`)
}

async function runEpisodesOnly() {
  const existing = readExisting()
  if (existing.length === 0) {
    throw new Error('No existing anime.json to update — run a full refresh first (without --episodes-only).')
  }

  const byId = new Map(existing.filter((a) => a && Number.isInteger(a.id)).map((a) => [a.id, a]))
  await refreshEpisodeInfo(byId)

  const total = writeOut(byId)
  console.log(`\nDone: episode info refreshed across ${total} anime.`)
  console.log(`File: ${OUT_FILE}`)
}

async function main() {
  if (episodesOnly) {
    await runEpisodesOnly()
  } else {
    await runFullRefresh()
  }
}

main().catch((error) => {
  console.error(`\nFailed: ${error.message}`)
  console.error('Your existing anime.json was not changed.')
  process.exit(1)
})