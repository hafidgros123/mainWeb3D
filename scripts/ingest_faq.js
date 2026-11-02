// scripts/ingest_faq.js
//
// Loads the FAQ JSONL into Supabase (kb_documents + kb_chunks) with Gemini
// embeddings. Safe to re-run: it first deletes previously ingested FAQ rows
// (source starts with "faq:") and re-inserts everything.
//
// Usage (from the project root):
//   node scripts/ingest_faq.js
// By default it reads scripts/ellenbot_faq_rag_revised.jsonl (next to this file).
// To use another file:  node scripts/ingest_faq.js "C:\full\path\to\faq.jsonl"

import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Load serverless-side/.env no matter where this script is run from.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.resolve(__dirname, '..', 'serverless-side', '.env')
const envResult = dotenv.config({ path: envPath })
if (envResult.error) {
  console.error(`Could not load .env from ${envPath}`)
  console.error(envResult.error.message)
  process.exit(1)
}

// text-embedding-004 was shut down; gemini-embedding-001 replaces it.
// It returns 3072 dims by default, so we ask for 768 to match
// kb_chunks.embedding vector(768).
const EMBEDDING_MODEL = 'gemini-embedding-001'
const EMBEDDING_DIMENSIONS = 768

const inputPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(__dirname, 'ellenbot_faq_rag_revised.jsonl')

if (!fs.existsSync(inputPath)) {
  console.error(`FAQ file not found: ${inputPath}`)
  console.error('Put ellenbot_faq_rag_revised.jsonl in the scripts folder, or pass its full path as an argument.')
  process.exit(1)
}

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const geminiApiKey = process.env.GEMINI_API_KEY

if (!supabaseUrl || !supabaseServiceRoleKey || !geminiApiKey) {
  console.error('Missing VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or GEMINI_API_KEY in serverless-side/.env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function embed(text) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`

  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiApiKey },
      body: JSON.stringify({
        model: `models/${EMBEDDING_MODEL}`,
        content: { parts: [{ text }] },
        taskType: 'RETRIEVAL_DOCUMENT',
        outputDimensionality: EMBEDDING_DIMENSIONS,
      }),
    })

    if (res.ok) {
      const json = await res.json()
      const values = json.embedding?.values
      if (!Array.isArray(values) || values.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(`Expected ${EMBEDDING_DIMENSIONS} dims, got ${values?.length}`)
      }
      return values
    }

    // Free tier is rate limited: wait and retry on 429 / 5xx.
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      await sleep(2000 * (attempt + 1))
      continue
    }
    throw new Error(`Gemini embedding failed (${res.status}): ${await res.text()}`)
  }
}

// Text that gets embedded: question + alternate phrasings + answer + keywords,
// so differently-worded questions still land near this entry.
function buildEmbeddingText(entry) {
  return [
    entry.question,
    ...(entry.alternate_questions ?? []),
    entry.answer,
    (entry.keywords ?? []).join(', '),
  ].filter(Boolean).join('\n')
}

// Text stored as the chunk and later shown to Ellen as context.
// Question + answer, so the context reads as a proper FAQ entry.
function buildChunkContent(entry) {
  return `Q: ${entry.question}\nA: ${entry.answer}`
}

async function clearPreviousFaq() {
  const { data: old, error } = await supabase.from('kb_documents').select('id').like('source', 'faq:%')
  if (error) throw error
  if (!old?.length) return 0

  const ids = old.map((row) => row.id)
  const { error: chunkErr } = await supabase.from('kb_chunks').delete().in('document_id', ids)
  if (chunkErr) throw chunkErr
  const { error: docErr } = await supabase.from('kb_documents').delete().in('id', ids)
  if (docErr) throw docErr
  return ids.length
}

async function main() {
  const removed = await clearPreviousFaq()
  if (removed) console.log(`Cleared ${removed} previously ingested FAQ entries.`)

  const rl = readline.createInterface({ input: fs.createReadStream(inputPath), crlfDelay: Infinity })

  let count = 0
  let failed = 0

  for await (const line of rl) {
    const trimmed = line.trim()
    if (!trimmed) continue

    let entry
    try {
      entry = JSON.parse(trimmed)
    } catch {
      console.warn(`Skipping unparsable line: ${trimmed.slice(0, 60)}...`)
      continue
    }

    let docId = null
    try {
      // Embed first so a failed embedding never leaves an orphan document row.
      const embedding = await embed(buildEmbeddingText(entry))

      const { data: doc, error: docError } = await supabase
        .from('kb_documents')
        .insert({
          title: entry.question,
          source: `faq:${entry.id ?? 'unknown'}#${entry.category ?? 'uncategorized'}`,
        })
        .select('id')
        .single()
      if (docError) throw docError
      docId = doc.id

      const { error: chunkError } = await supabase
        .from('kb_chunks')
        .insert({ document_id: docId, content: buildChunkContent(entry), embedding })
      if (chunkError) throw chunkError

      count += 1
      console.log(`OK [${count}] ${entry.id ?? docId} - ${entry.question}`)
    } catch (error) {
      failed += 1
      if (docId) await supabase.from('kb_documents').delete().eq('id', docId)
      console.error(`FAILED "${entry.question ?? entry.id}":`, error.message || error)
    }
  }

  console.log(`\nDone. Ingested ${count} entries, ${failed} failed.`)
  if (failed) process.exit(1)
}

main().catch((error) => {
  console.error('Fatal error:', error.message || error)
  process.exit(1)
})
