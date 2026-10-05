import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getDb, type DbOrTx } from "@/server/db/client";
import { enquiries } from "@/server/db/schema";

export type EnquiryStatus = "new" | "contacted" | "closed";

export async function insertEnquiry(
  values: {
    name: string;
    phone: string;
    email: string | null;
    preferredRoomType: string;
    expectedJoiningDate: string;
    message: string;
    ipHash: string;
  },
  dbx: DbOrTx = getDb(),
) {
  await dbx.insert(enquiries).values(values);
}

export async function countSince(ipHash: string, since: Date, dbx: DbOrTx = getDb()) {
  const [row] = await dbx
    .select({ n: sql<number>`count(*)::int` })
    .from(enquiries)
    .where(and(eq(enquiries.ipHash, ipHash), gte(enquiries.createdAt, since)));
  return row?.n ?? 0;
}

/** Warden only. ip_hash is deliberately not selected. */
export async function listEnquiries(status: EnquiryStatus | undefined, dbx: DbOrTx = getDb()) {
  return dbx
    .select({
      id: enquiries.id,
      name: enquiries.name,
      phone: enquiries.phone,
      email: enquiries.email,
      preferredRoomType: enquiries.preferredRoomType,
      expectedJoiningDate: enquiries.expectedJoiningDate,
      message: enquiries.message,
      status: enquiries.status,
      createdAt: enquiries.createdAt,
    })
    .from(enquiries)
    .where(status ? eq(enquiries.status, status) : undefined)
    .orderBy(desc(enquiries.createdAt))
    .limit(500);
}

export async function countByStatus(dbx: DbOrTx = getDb()) {
  const rows = await dbx.select({ status: enquiries.status, n: sql<number>`count(*)::int` }).from(enquiries).groupBy(enquiries.status);
  const out = { new: 0, contacted: 0, closed: 0 };
  for (const r of rows) out[r.status] = r.n;
  return out;
}

export async function updateEnquiryStatus(id: string, status: EnquiryStatus, dbx: DbOrTx = getDb()) {
  const [row] = await dbx.update(enquiries).set({ status }).where(eq(enquiries.id, id)).returning({ id: enquiries.id });
  return row ?? null;
}

export async function deleteEnquiry(id: string, dbx: DbOrTx = getDb()) {
  const rows = await dbx.delete(enquiries).where(eq(enquiries.id, id)).returning({ id: enquiries.id });
  return rows.length > 0;
}
