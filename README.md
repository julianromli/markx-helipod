# markx

A spatial bookmark board — drop links, notes, images, and folders onto an infinite canvas and arrange them your way. Everything is stored locally in your browser (IndexedDB), so your board is private and works offline.

## Stack

- [TanStack Start](https://tanstack.com/start) + React 19 + TypeScript
- [shadcn/ui](https://ui.shadcn.com/) (base-luma) + Tailwind CSS v4
- [Tiptap](https://tiptap.dev/) for notes
- IndexedDB for local persistence

## Getting started

```bash
bun install
bun run dev      # http://localhost:3000
```

Other scripts:

```bash
bun run build    # production build
bun run preview  # preview the build
bun run typecheck
bun run test
npx playwright install chromium webkit  # once, browser binaries
bun run test:e2e # Playwright phone, tablet, and desktop flows; starts
                 # `bun run dev` itself (needs .dev.vars) unless MARKX_URL is set
```

## Adding shadcn components

```bash
npx shadcn@latest add button
```

Components live in `src/components/ui` and are imported as:

```tsx
import { Button } from "@/components/ui/button";
```

## Production (Node)

The app runs as a plain Node server (no platform-specific bindings):

```bash
bun run build
bun run start    # srvx: static dist/client + SSR dist/server/server.js
```

Configuration comes from environment variables (see `.dev.vars.example`
for the full list): `DATABASE_URL` (Neon Postgres pooler),
`NEON_AUTH_BASE_URL`, `NEON_AUTH_JWKS_URL`, Mayar billing vars, and
`MARKX_ASSETS_DIR` (disk asset store — point it at a persistent volume).

A `Dockerfile` is included; it builds the app and serves on port `3000`
with a `/health` endpoint for container health checks.
