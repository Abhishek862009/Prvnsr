import { ApiError } from "./api";
import { en } from "@/messages/en";

/**
 * Backups are small (well under 1 MB for a hostel). 4 MB also fits typical serverless request limits.
 * If the hosting limit is lower, uploads fail at the platform before reaching this code.
 */
export const BACKUP_UPLOAD_MAX_BYTES = 4_000_000;

/** Reads a multipart form with a backup file + password (+ optional confirm text). */
export async function readBackupForm(req: Request): Promise<{ file: Buffer; password: string; confirm: string }> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > BACKUP_UPLOAD_MAX_BYTES + 10_000) throw new ApiError(413, "too_large", en.http.tooLarge);
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new ApiError(400, "bad_request", en.http.badRequest);
  }
  const file = form.get("file");
  const password = form.get("password");
  const confirm = form.get("confirm");
  if (!(file instanceof File) || typeof password !== "string" || password.length === 0 || password.length > 256) {
    throw new ApiError(400, "validation_error", en.http.validation);
  }
  if (file.size === 0 || file.size > BACKUP_UPLOAD_MAX_BYTES) throw new ApiError(413, "too_large", en.http.tooLarge);
  return { file: Buffer.from(await file.arrayBuffer()), password, confirm: typeof confirm === "string" ? confirm : "" };
}
