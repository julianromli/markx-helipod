import { createReadStream } from "node:fs"
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises"
import { dirname, join, normalize, resolve, sep } from "node:path"
import { Readable } from "node:stream"

import { getServerEnv } from "@/lib/server/env"

/**
 * Disk-backed asset store.
 *
 * Replaces the previous R2 bucket binding. Object keys (e.g.
 * `assets/<userId>/<imageId>`, `og-previews/<hash>`) map to files under the
 * store's base directory; content type is kept in a `.meta.json` sidecar so
 * `get`/`head` can report `httpMetadata.contentType` like R2 did.
 *
 * In production the base directory should point at a persistent volume so
 * uploaded images survive container restarts.
 */

export type AssetHttpMetadata = { contentType?: string }

export type StoredAssetObject = {
  httpMetadata?: AssetHttpMetadata
  arrayBuffer(): Promise<ArrayBuffer>
  readonly body: ReadableStream<Uint8Array>
}

const DEFAULT_ASSETS_DIR = join(process.cwd(), "data", "assets")

function baseDir(): string {
  const configured = getServerEnv().MARKX_ASSETS_DIR
  return configured ? resolve(configured) : DEFAULT_ASSETS_DIR
}

/**
 * Resolve an object key to an absolute file path inside the store. Rejects
 * keys that try to escape the base directory (e.g. `..` or absolute paths).
 */
function objectPath(key: string): string | null {
  const normalized = normalize(key)
  if (
    normalized === "" ||
    normalized === "." ||
    normalized.startsWith("..") ||
    normalized.startsWith("/") ||
    normalized.startsWith("\\")
  ) {
    return null
  }
  const path = join(baseDir(), normalized)
  if (!path.startsWith(baseDir() + sep)) return null
  return path
}

async function readMetaFile(path: string): Promise<AssetHttpMetadata | undefined> {
  try {
    const raw = await readFile(`${path}.meta.json`, "utf8")
    const parsed = JSON.parse(raw) as AssetHttpMetadata
    return parsed ?? undefined
  } catch {
    return undefined
  }
}

function toWebReadable(path: string): ReadableStream<Uint8Array> {
  return Readable.toWeb(createReadStream(path)) as unknown as ReadableStream<Uint8Array>
}

function wrapObject(
  path: string,
  httpMetadata: AssetHttpMetadata | undefined
): StoredAssetObject {
  return {
    httpMetadata,
    body: toWebReadable(path),
    async arrayBuffer() {
      const buffer = await readFile(path)
      return buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
      ) as ArrayBuffer
    },
  }
}

export const assetStore = {
  async put(
    key: string,
    bytes: Uint8Array,
    options?: { httpMetadata?: AssetHttpMetadata }
  ): Promise<void> {
    const path = objectPath(key)
    if (!path) throw new Error(`Invalid asset object key: ${key}`)

    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, bytes)

    const meta = options?.httpMetadata
    if (meta) {
      await writeFile(`${path}.meta.json`, JSON.stringify(meta), "utf8")
    }
  },

  async get(key: string): Promise<StoredAssetObject | null> {
    const path = objectPath(key)
    if (!path) return null
    try {
      await stat(path)
    } catch {
      return null
    }
    const httpMetadata = await readMetaFile(path)
    return wrapObject(path, httpMetadata)
  },

  async head(key: string): Promise<{ httpMetadata?: AssetHttpMetadata } | null> {
    const path = objectPath(key)
    if (!path) return null
    try {
      await stat(path)
    } catch {
      return null
    }
    return { httpMetadata: await readMetaFile(path) }
  },

  async delete(key: string): Promise<void> {
    const path = objectPath(key)
    if (!path) return
    await rm(path, { force: true })
    await rm(`${path}.meta.json`, { force: true })
  },
}
