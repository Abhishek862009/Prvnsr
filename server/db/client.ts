import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import { getEnv } from "@/server/config/env";
import * as schema from "./schema";

// Pool/WebSocket driver (not the HTTP driver) so interactive transactions work.
neonConfig.webSocketConstructor = ws;

function createDb() {
  const pool = new Pool({ connectionString: getEnv().DATABASE_URL, max: 5 });
  pool.on("error", (err) => console.error("Database pool error:", err.name));
  return drizzle(pool, { schema });
}

export type Db = ReturnType<typeof createDb>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
/** Repos accept either the root db or a transaction. */
export type DbOrTx = Pick<Db, "select" | "insert" | "update" | "delete">;

const globalForDb = globalThis as unknown as { __vbDb?: Db };

/** Lazily created, reused across hot reloads in development. */
export function getDb(): Db {
  globalForDb.__vbDb ??= createDb();
  return globalForDb.__vbDb;
}
