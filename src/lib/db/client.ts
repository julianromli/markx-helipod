import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

/**
 * Database client factory.
 *
 * Reads `DATABASE_URL` from the server environment (see
 * `@/lib/server/env`). A new client is created per request and released by
 * {@link withDb}; `postgres` manages the connection pool internally.
 */
export async function getDb() {
  const { getServerEnv } = await import("@/lib/server/env")
  const connectionString = getServerEnv().DATABASE_URL

  if (!connectionString) {
    throw new Error("No database connection available. Set DATABASE_URL.")
  }

  const sql = postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
  })

  return { db: drizzle(sql, { schema }), sql }
}

export type DbConnection = Awaited<ReturnType<typeof getDb>>
export type Database = Awaited<ReturnType<typeof getDb>>["db"]

/**
 * Run a database operation and always release its postgres client.
 *
 * Keeping lifecycle management here prevents server services from leaking
 * connections when an operation throws or returns early.
 */
export async function withDb<T>(
  operation: (connection: DbConnection) => Promise<T>
): Promise<T> {
  const connection = await getDb()
  try {
    return await operation(connection)
  } finally {
    await connection.sql.end()
  }
}
