import { requireWardenApi } from "@/server/auth/guards";
import { ApiError, apiHandler, ok } from "@/server/http/api";
import { floorParamSchema } from "@/server/http/schemas";
import { getFloorMap } from "@/server/services/checking";
import { en } from "@/messages/en";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ floor: string }> };

export const GET = apiHandler<Ctx>(async (_req, { params }) => {
  await requireWardenApi();
  const floor = floorParamSchema.safeParse((await params).floor);
  if (!floor.success) throw new ApiError(404, "not_found", en.http.notFound);
  return ok(await getFloorMap(floor.data));
});
