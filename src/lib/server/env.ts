/**
 * Server-side environment access.
 *
 * All server code reads configuration from `process.env` through this module,
 * so no runtime-specific binding module (e.g. `cloudflare:workers`) is ever
 * imported.
 *
 * Values come from:
 *  - Development: `.dev.vars`, loaded into `process.env` by `scripts/dev.ts`
 *    before Vite starts.
 *  - Production: the container platform's service environment variables.
 */
export type ServerEnv = {
  DATABASE_URL?: string

  /** Neon Auth (Better Auth) endpoints. Non-secret. */
  NEON_AUTH_BASE_URL?: string
  NEON_AUTH_JWKS_URL?: string

  /** Mayar billing. `MAYAR_BILLING_ENABLED` is a feature flag ("true"/"false"). */
  MAYAR_BILLING_ENABLED?: string
  MAYAR_API_KEY?: string
  MAYAR_ENV?: string
  MAYAR_PRO_PRICE_IDR?: string
  MAYAR_MEMBERSHIP_PRODUCT_ID?: string
  MAYAR_MEMBERSHIP_TIER_ID?: string

  /** Public origin of this deployment, e.g. https://markx.helipod.app */
  APP_URL?: string

  /** Directory for image assets on disk. Defaults to `./data/assets`. */
  MARKX_ASSETS_DIR?: string

  /** Disable the daily asset-cleanup job when set to "false". */
  MARKX_CRON_ENABLED?: string
}

/**
 * The process environment as `ServerEnv`. Returns a live reference (not a
 * snapshot) so callers can rely on standard Node.js semantics.
 */
export function getServerEnv(): ServerEnv {
  return process.env as NodeJS.ProcessEnv & ServerEnv
}

/** `NEON_AUTH_BASE_URL` or a descriptive error. */
export function requireNeonAuthBaseUrl(): string {
  const env = getServerEnv()
  if (!env.NEON_AUTH_BASE_URL) {
    throw new Error("NEON_AUTH_BASE_URL is not configured")
  }
  return env.NEON_AUTH_BASE_URL
}
