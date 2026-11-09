const OAUTH_PROVIDERS = new Set(['google', 'github', 'facebook', 'discord'])

export function isOAuthUser(user) {
  const appMetadata = user?.app_metadata
  const providers = Array.isArray(appMetadata?.providers) ? appMetadata.providers : []

  return OAUTH_PROVIDERS.has(appMetadata?.provider) || providers.some((provider) => OAUTH_PROVIDERS.has(provider))
}
