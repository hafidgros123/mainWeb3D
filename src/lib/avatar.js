// Shared rules for profile pictures.
// Only pictures from your own Supabase "avatars" bucket (or a file on your own site)
// are ever shown, so nobody can point their picture at a random outside website.

export const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp']
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024 // same limit as the bucket

const AVATAR_BUCKET_URL = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/avatars/`

export function safeAvatarUrl(url) {
  if (typeof url !== 'string' || !url) return null
  if (url.startsWith(AVATAR_BUCKET_URL)) return url
  if (url.startsWith('/') && !url.startsWith('//')) return url
  return null
}
