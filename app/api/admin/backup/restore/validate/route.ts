import { requireWardenApi } from "@/server/auth/guards";
import { apiHandler, ok } from "@/server/http/api";
import { readBackupForm } from "@/server/http/upload";
import { assertSameOrigin } from "@/server/security/origin";
import { previewRestore } from "@/server/services/backup";

export const runtime = "nodejs";

/** multipart: file + password. Decrypts and fully validates; changes nothing. */
export const POST = apiHandler(async (req) => {
  assertSameOrigin(req);
  await requireWardenApi();
  const { file, password } = await readBackupForm(req);
  return ok({ preview: previewRestore(file, password) });
});
