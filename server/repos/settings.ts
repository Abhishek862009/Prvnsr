import { eq, inArray } from "drizzle-orm";
import { getDb, type DbOrTx } from "@/server/db/client";
import { appSettings } from "@/server/db/schema";

export async function getSettings(keys: string[], dbx: DbOrTx = getDb()): Promise<Record<string, string>> {
  const rows = await dbx.select({ key: appSettings.key, value: appSettings.value }).from(appSettings).where(inArray(appSettings.key, keys));
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function upsertSetting(key: string, value: string, dbx: DbOrTx = getDb()) {
  await dbx.insert(appSettings).values({ key, value }).onConflictDoUpdate({ target: appSettings.key, set: { value } });
}

export async function deleteSetting(key: string, dbx: DbOrTx = getDb()) {
  await dbx.delete(appSettings).where(eq(appSettings.key, key));
}
