import handler from "@tanstack/react-start/server-entry"
import { startAssetCleanupCron } from "@/lib/server/asset-cleanup-cron"
import {
  buildAuthProxyHeaders,
  buildAuthTargetUrl,
  isAuthProxyPath,
  isEmailOtpSendPath,
  rewriteAuthCookie,
} from "@/lib/server/auth-proxy"
import { getServerEnv } from "@/lib/server/env"
import { checkOtpSendRateLimit } from "@/lib/server/otp-send-rate-limit"
import { serveOgPreview } from "@/lib/server/og-preview"
import { serveSharedBoardAsset } from "@/lib/server/shared-board-asset"

/**
 * Server entry for the Node deployment.
 *
 * Request pipeline (all same-origin, no platform-specific bindings):
 *
 *  1. `/health` — liveness probe for the container platform.
 *  2. `/api/auth/*` — same-origin reverse proxy for Neon Auth (Better Auth).
 *  3. `/og/...`, `/s/.../asset/...` — stored image assets.
 *  4. Everything else — the TanStack Start SSR handler.
 *
 * The daily asset-cleanup job (previously a Workers cron trigger) starts
 * here on boot in production.
 */

if (process.env.NODE_ENV === "production") {
  startAssetCleanupCron()
}

/**
 * Same-origin reverse proxy for Neon Auth (Better Auth).
 *
 * The browser calls `/api/auth/*` on this origin. We forward each request
 * to the managed Neon Auth service, then rewrite Set-Cookie headers so the
 * session cookies become first-party (no Domain attribute). This avoids
 * Safari ITP blocking third-party cookies on the cross-origin auth host
 * while keeping JWT verification against the Neon JWKS endpoint.
 */
async function proxyAuth(request: Request): Promise<Response | null> {
  const url = new URL(request.url)
  if (!isAuthProxyPath(url.pathname)) return null

  // Throttle OTP email sends before they hit Neon Auth / SMTP.
  if (
    request.method === "POST" &&
    isEmailOtpSendPath(url.pathname)
  ) {
    const limited = checkOtpSendRateLimit(request)
    if (limited) return limited
  }

  const authBaseUrl = getServerEnv().NEON_AUTH_BASE_URL
  if (!authBaseUrl) {
    return new Response("Auth is not configured", { status: 503 })
  }
  const target = buildAuthTargetUrl(request.url, authBaseUrl)

  // Build a minimal header set for the upstream request. We deliberately do
  // NOT copy all request headers — browsers send headers (Host,
  // X-Forwarded-*, Referer, …) that Better Auth's hostname validation
  // rejects.
  const headers = buildAuthProxyHeaders(request.headers)

  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body:
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : request.body,
    redirect: "manual",
  })

  const response = new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: upstream.headers,
  })

  // Strip Domain so cookies are first-party, and normalize an existing
  // SameSite attribute to Lax.
  const setCookies = response.headers.getSetCookie()
  if (setCookies.length > 0) {
    response.headers.delete("set-cookie")
    for (const cookie of setCookies) {
      response.headers.append("set-cookie", rewriteAuthCookie(cookie))
    }
  }

  return response
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === "/health") {
      return new Response("OK", { status: 200 })
    }

    const authResponse = await proxyAuth(request)
    if (authResponse) return authResponse

    const ogPreview = await serveOgPreview(request)
    if (ogPreview) return ogPreview

    const sharedAsset = await serveSharedBoardAsset(request)
    if (sharedAsset) return sharedAsset

    // TanStack Start's handler only needs the Request.
    return handler.fetch(request)
  },
}
