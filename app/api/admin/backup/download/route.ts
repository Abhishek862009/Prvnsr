import { requireWardenApi } from "@/server/auth/guards";
import { ApiError, apiHandler, readJson } from "@/server/http/api";
import { backupDownloadSchema } from "@/server/http/schemas";
import { assertSameOrigin } from "@/server/security/origin";
import { createBackupFile } from "@/server/services/backup";

export const runtime = "nodejs";

/** POST (not GET) so the backup password never appears in a URL. Returns the encrypted ZIP. */
export const POST = apiHandler(async (req) => {
  assertSameOrigin(req);
  await requireWardenApi();
  const { password, confirmPassword } = await readJson(req, backupDownloadSchema);
  const { buffer, filename } = await createBackupFile(password, confirmPassword);
  if (buffer.length === 0) throw new ApiError(500, "server_error", "Backup failed.");
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});
