import { requireWardenApi } from "@/server/auth/guards";
import { apiHandler } from "@/server/http/api";
import { sampleRoomImportCsv } from "@/server/lib/room-import-format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler(async () => {
  await requireWardenApi();
  return new Response(sampleRoomImportCsv(), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="rooms-sample.csv"',
      "Cache-Control": "no-store",
    },
  });
});
