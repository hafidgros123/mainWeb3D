// Everything about loading the dice pictures, so the dice never show an old face
// and the throw animation always starts from its first frame.

const FOLDER = '/dice_images'
const THROW_URL = `${FOLDER}/dice_throw.webp`

export function faceUrl(value) {
  return `${FOLDER}/dice_${String(value).padStart(2, '0')}.png`
}

// --- die faces: each picture is loaded (and decoded) once, then reused ---
const faces = new Map()

export function loadFace(value) {
  if (!faces.has(value)) {
    const image = new Image()
    image.src = faceUrl(value)
    faces.set(value, image.decode().catch(() => {})) // a failed picture must never block a roll
  }
  return faces.get(value)
}

export function preloadFaces() {
  for (let value = 0; value <= 20; value += 1) loadFace(value)
}

// --- throw animation ---
// A browser keeps playing a shared animated picture from where it was, so showing the same
// URL again can start in the middle. A brand-new blob URL for every roll always starts at frame 1.
let throwBlob = null

export function preloadThrow() {
  if (throwBlob) return
  fetch(THROW_URL)
    .then((response) => response.blob())
    .then((blob) => { throwBlob = blob })
    .catch(() => {})
}

export function newThrowUrl() {
  return throwBlob ? URL.createObjectURL(throwBlob) : THROW_URL
}

export function releaseThrowUrl(url) {
  if (url.startsWith('blob:')) URL.revokeObjectURL(url)
}