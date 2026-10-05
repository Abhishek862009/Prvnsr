import { requireParentApi } from "@/server/auth/guards";
import { apiHandler, ok } from "@/server/http/api";
import { listLinkedStudents } from "@/server/repos/parents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Returns ONLY students linked to the signed-in parent. */
export const GET = apiHandler(async () => {
  const parent = await requireParentApi();
  const students = await listLinkedStudents(parent.parentId);
  return ok({ students });
});
