import { cleanupExpiredAssets } from "@/lib/server/assets.server"
import { getServerEnv } from "@/lib/server/env"

/**
 * Daily maintenance job: at 03:00 UTC, delete asset objects whose rows are
 * soft-deleted past the retention window.
 *
 * The previous Cloudflare Worker used a cron trigger; on Node we schedule
 * the same job with a `setTimeout` chain that fires at the next 03:00 UTC.
 */

const CRON_HOUR_UTC = 3
const TICK_CHECK_INTERVAL_MS = 15 * 60 * 1000

let started = false

function msUntilNextRun(now = new Date()): number {
  const next = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    CRON_HOUR_UTC,
    0,
    0,
    0
  )
  if (next <= now.getTime()) {
    return next + 24 * 60 * 60 * 1000 - now.getTime()
  }
  return next - now.getTime()
}

async function runOnce(): Promise<void> {
  try {
    await cleanupExpiredAssets()
    console.log("[cron] asset cleanup finished")
  } catch (error) {
    console.error("[cron] asset cleanup failed", error)
  }
}

/** Schedule the recurring check. Fires roughly at 03:00 UTC each day. */
function schedule(): void {
  setTimeout(() => {
    const now = new Date()
    if (
      now.getUTCHours() === CRON_HOUR_UTC &&
      now.getUTCMinutes() < 15 &&
      now.getUTCSeconds() < 60
    ) {
      void runOnce().finally(schedule)
    } else {
      schedule()
    }
  }, TICK_CHECK_INTERVAL_MS)
}

/** Run the cleanup once at boot (catch-up), then keep the daily schedule. */
export function startAssetCleanupCron(): void {
  if (started) return
  started = true

  const env = getServerEnv()
  if (env.MARKX_CRON_ENABLED === "false") return

  const msToNext = msUntilNextRun()
  const hoursToNext = Math.round(msToNext / 3_600_000)
  console.log(
    `[cron] asset cleanup scheduled at 0${CRON_HOUR_UTC}:00 UTC (in ~${hoursToNext}h)`
  )

  schedule()
}
