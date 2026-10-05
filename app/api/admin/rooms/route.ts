import { requireWardenApi } from "@/server/auth/guards";
import { apiHandler, ok, readJson } from "@/server/http/api";
import { roomCreateSchema } from "@/server/http/schemas";
import { assertSameOrigin } from "@/server/security/origin";
import { createRoom, listRooms } from "@/server/services/rooms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler(async () => {
  await requireWardenApi();
  return ok({ rooms: await listRooms() });
});

export const POST = apiHandler(async (req) => {
  assertSameOrigin(req);
  await requireWardenApi();
  const body = await readJson(req, roomCreateSchema);
  return ok({ room: await createRoom(body) }, 201);
});
