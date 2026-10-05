import { requireWardenApi } from "@/server/auth/guards";
import { ApiError, apiHandler, ok, readText } from "@/server/http/api";
import { IMPORT_LIMITS } from "@/server/lib/import-format";
import { assertSameOrigin } from "@/server/security/origin";
import { commitStudentImport } from "@/server/services/student-import";

export const runtime = "nodejs";

/** Body: the same raw CSV text that was previewed. Applies everything or nothing. */
export const POST = apiHandler(async (req) => {
  assertSameOrigin(req);
  await requireWardenApi();
  const csv = await readText(req, IMPORT_LIMITS.maxBytes);
  const result = await commitStudentImport(csv);
  if (!result.committed) {
    throw new ApiError(422, "import_has_errors", "The file has errors. Nothing was imported.");
  }
  return ok({ committed: true, created: result.created, updated: result.updated });
});
