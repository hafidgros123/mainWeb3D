// Everything about loading the dice pictures, so the dice never show an old face
// and the throw animation always starts from its first frame.

const FOLDER = '/dice_images'
const THROW_URL = `${FOLDER}/dice_throw.webp`

export function faceUrl(value: number | string): string {
  return `${FOLDER}/dice_${String(value).padStart(2, '0')}.webp`
}

// --- die faces: each picture is loaded (and decoded) once, then reused ---
const faces = new Map<number, Promise<void>>()

export function loadFace(value: number): Promise<void> {
  let loading = faces.get(value)
  if (!loading) {
    const image = new Image()
    image.src = faceUrl(value)
    loading = image.decode().catch(() => {}) // a failed picture must never block a roll
    faces.set(value, loading)
  }
  return loading
}

export function preloadFaces(): void {
  for (let value = 0; value <= 20; value += 1) void loadFace(value)
}

// --- throw animation ---
// A browser keeps playing a shared animated picture from where it was, so showing the same
// URL again can start in the middle. A brand-new blob URL for every roll always starts at frame 1.
let throwBlob: Blob | null = null

export function preloadThrow(): void {
  if (throwBlob) return
  fetch(THROW_URL)
    .then((response) => response.blob())
    .then((blob) => { throwBlob = blob })
    .catch(() => {})
}

export function newThrowUrl(): string {
  return throwBlob ? URL.createObjectURL(throwBlob) : THROW_URL
}

export function releaseThrowUrl(url: string): void {
  if (url.startsWith('blob:')) URL.revokeObjectURL(url)
}
