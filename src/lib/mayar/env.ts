export type MayarConfig = {
  apiKey: string
  baseUrl: string
  /** Markx Pro price in IDR, billed via QRIS invoice. */
  proPriceIdr: number
}

const DEFAULT_PRO_PRICE_IDR = 49_000

/** Env values are strings — treat 1/true/yes/on as enabled. */
export function parseTruthyFlag(value: string | undefined | null): boolean {
  if (value == null) return false
  const normalized = value.trim().toLowerCase()
  return (
    normalized === "1" ||
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "on"
  )
}

/**
 * Feature flag for Pro entity limits + Mayar checkout UI.
 * Set `MAYAR_BILLING_ENABLED=true` in the service environment.
 * Pro activation is verify-on-read; no webhook is involved either way.
 */
export async function isMayarBillingEnabled(): Promise<boolean> {
  const { getServerEnv } = await import("@/lib/server/env")
  return parseTruthyFlag(getServerEnv().MAYAR_BILLING_ENABLED)
}

export async function getMayarConfig(): Promise<MayarConfig> {
  const { getServerEnv } = await import("@/lib/server/env")
  const bindings = getServerEnv()

  const apiKey = bindings.MAYAR_API_KEY?.trim()
  if (!apiKey) {
    throw new Error("MAYAR_API_KEY is not configured")
  }

  const baseUrl =
    bindings.MAYAR_ENV === "production"
      ? "https://api.mayar.id/hl/v2"
      : "https://api.mayar.club/hl/v2"

  const parsedPrice = Number.parseInt(
    bindings.MAYAR_PRO_PRICE_IDR?.trim() ?? "",
    10
  )
  const proPriceIdr =
    Number.isFinite(parsedPrice) && parsedPrice > 0
      ? parsedPrice
      : DEFAULT_PRO_PRICE_IDR

  return { apiKey, baseUrl, proPriceIdr }
}
