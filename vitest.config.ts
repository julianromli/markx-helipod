import { defineConfig } from "vitest/config"
import viteReact from "@vitejs/plugin-react"
import { fileURLToPath } from "node:url"

/**
 * Vitest configuration.
 *
 * Tests only need TypeScript path resolution and the React JSX transform —
 * no SSR or platform bindings. Server code reads `process.env` directly, so
 * tests that exercise env-dependent paths can set `process.env` values.
 */
export default defineConfig({
  plugins: [viteReact()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
  },
})
