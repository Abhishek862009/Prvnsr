import { requireWardenApi } from "@/server/auth/guards";
import { apiHandler, ok, readJson } from "@/server/http/api";
import { settingsSchema } from "@/server/http/schemas";
import { assertSameOrigin } from "@/server/security/origin";
import { getPublicSettings, updatePublicSettings } from "@/server/services/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler(async () => {
  await requireWardenApi();
  return ok({ settings: await getPublicSettings() });
});

/** Body: { callNumber?, whatsappNumber? }. Blank clears a number (its button disappears from the site). */
export const PUT = apiHandler(async (req) => {
  assertSameOrigin(req);
  await requireWardenApi();
  const body = await readJson(req, settingsSchema);
  return ok({ settings: await updatePublicSettings(body) });
});
