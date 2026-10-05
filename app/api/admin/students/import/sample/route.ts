import { requireWardenApi } from "@/server/auth/guards";
import { apiHandler } from "@/server/http/api";
import { sampleImportCsv } from "@/server/lib/import-format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler(async () => {
  await requireWardenApi();
  return new Response(sampleImportCsv(), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="students-sample.csv"',
      "Cache-Control": "no-store",
    },
  });
});
