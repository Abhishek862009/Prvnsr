import { requireWardenApi } from "@/server/auth/guards";
import { apiHandler, ok } from "@/server/http/api";
import { readBackupForm } from "@/server/http/upload";
import { assertSameOrigin } from "@/server/security/origin";
import { restoreBackup } from "@/server/services/backup";

export const runtime = "nodejs";

/**
 * multipart: file + password + confirm ("RESTORE"). Re-validates, saves an encrypted safety backup of the
 * current data, then replaces the data in ONE transaction (rolled back on any failure).
 */
export const POST = apiHandler(async (req) => {
  assertSameOrigin(req);
  await requireWardenApi();
  const { file, password, confirm } = await readBackupForm(req);
  return ok(await restoreBackup(file, password, confirm));
});
