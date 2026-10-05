import { NextResponse } from "next/server";
import { getPublicAvailability } from "@/server/services/public-site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * PUBLIC, read-only. Whitelisted payload: { rooms: [{roomNumber, status}], settings: {callNumber, whatsappNumber} }.
 * Never cached, so a manual refresh always shows the Warden's latest change.
 */
export async function GET() {
  const data = await getPublicAvailability();
  return NextResponse.json(data, {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0", Pragma: "no-cache", "CDN-Cache-Control": "no-store" },
  });
}
