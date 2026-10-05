import { requireWardenApi } from "@/server/auth/guards";
import { apiHandler, ok, readText } from "@/server/http/api";
import { IMPORT_LIMITS } from "@/server/lib/import-format";
import { assertSameOrigin } from "@/server/security/origin";
import { previewStudentImport } from "@/server/services/student-import";

export const runtime = "nodejs";

/** Body: the raw CSV text (Content-Type: text/csv). Validates only; writes nothing. */
export const POST = apiHandler(async (req) => {
  assertSameOrigin(req);
  await requireWardenApi();
  const csv = await readText(req, IMPORT_LIMITS.maxBytes);
  return ok({ plan: await previewStudentImport(csv) });
});
