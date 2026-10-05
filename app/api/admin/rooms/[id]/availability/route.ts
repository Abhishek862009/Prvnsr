import { requireWardenApi } from "@/server/auth/guards";
import { apiHandler, ok, readJson } from "@/server/http/api";
import { availabilitySchema, parseUuid } from "@/server/http/schemas";
import { assertSameOrigin } from "@/server/security/origin";
import { setRoomPublicAvailability } from "@/server/services/rooms";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Manual public Available/Full. Does not touch daily checking status. */
export const POST = apiHandler<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  await requireWardenApi();
  const id = parseUuid((await params).id);
  const { availability } = await readJson(req, availabilitySchema);
  const room = await setRoomPublicAvailability(id, availability);
  return ok({ id: room.id, roomNumber: room.roomNumber, availability: room.publicAvailability });
});
