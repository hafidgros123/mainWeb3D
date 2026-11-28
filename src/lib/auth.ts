import type { User } from '@supabase/supabase-js'

const OAUTH_PROVIDERS = new Set(['google', 'github', 'facebook', 'discord'])

export function isOAuthUser(user: User | null | undefined): boolean {
  const appMetadata = user?.app_metadata
  const providers: string[] = Array.isArray(appMetadata?.providers) ? appMetadata.providers : []

  return OAUTH_PROVIDERS.has(appMetadata?.provider ?? '') || providers.some((provider) => OAUTH_PROVIDERS.has(provider))
}
