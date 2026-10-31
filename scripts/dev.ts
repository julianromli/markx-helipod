import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

/**
 * Dev launcher.
 *
 * Loads `.dev.vars` into `process.env` (server code reads configuration from
 * `process.env`; see `src/lib/server/env.ts`) and starts the Vite dev
 * server. Extra CLI args are forwarded to Vite.
 */

const DEV_VARS_PATH = resolve(import.meta.dirname, "..", ".dev.vars")

function parseDevVars(contents: string): Record<string, string> {
  const vars: Record<string, string> = {}

  for (const line of contents.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue

    const eq = trimmed.indexOf("=")
    if (eq === -1) continue

    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (key) vars[key] = value
  }

  return vars
}

if (existsSync(DEV_VARS_PATH)) {
  const devVars = parseDevVars(readFileSync(DEV_VARS_PATH, "utf8"))
  for (const [key, value] of Object.entries(devVars)) {
    process.env[key] ??= value
  }

  if (devVars.DATABASE_URL?.includes("ep-lingering-dust-azywq1po")) {
    console.warn(
      "DATABASE_URL points at the production Neon endpoint. A long local session keeps production compute active and burns CU-hours. Use a Neon development branch."
    )
  }
} else {
  console.warn(
    `No ${DEV_VARS_PATH} found. Copy .dev.vars.example to .dev.vars and set DATABASE_URL for local development.`
  )
}

// Ship Studio (and similar launchers) assign the port via PORT; keep 3000
// for manual runs. Extra CLI args are forwarded so launchers can pass flags.
const port = process.env.PORT ?? "3000"

const vite = Bun.spawn(
  ["vite", "dev", "--port", port, "--strictPort", ...process.argv.slice(2)],
  {
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
    env: process.env,
  }
)

process.exit(await vite.exited)
