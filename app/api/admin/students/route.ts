import { requireWardenApi } from "@/server/auth/guards";
import { ApiError, apiHandler, ok, readJson } from "@/server/http/api";
import { studentCreateSchema, studentQuerySchema } from "@/server/http/schemas";
import { assertSameOrigin } from "@/server/security/origin";
import { createStudent, searchStudents } from "@/server/services/students";
import { en } from "@/messages/en";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req) => {
  await requireWardenApi();
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const parsed = studentQuerySchema.safeParse(params);
  if (!parsed.success) throw new ApiError(400, "validation_error", en.http.validation);
  return ok({ students: await searchStudents(parsed.data) });
});

export const POST = apiHandler(async (req) => {
  assertSameOrigin(req);
  await requireWardenApi();
  const body = await readJson(req, studentCreateSchema);
  return ok({ student: await createStudent(body) }, 201);
});
