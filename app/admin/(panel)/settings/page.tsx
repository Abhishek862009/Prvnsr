import SettingsForm from "@/components/admin/SettingsForm";
import { requireWarden } from "@/server/auth/guards";
import { getPublicSettings } from "@/server/services/settings";
import { en } from "@/messages/en";

export const dynamic = "force-dynamic";

const t = en.admin.settings;

export default async function SettingsPage() {
  await requireWarden();
  const s = await getPublicSettings();
  return (
    <main className="max-w-xl space-y-4">
      <header>
        <h1 className="font-display text-3xl text-ink">{t.title}</h1>
        <p className="mt-1 text-stone-700">{t.intro}</p>
      </header>
      <SettingsForm initialCall={s.callNumber ?? ""} initialWhatsapp={s.whatsappNumber ?? ""} />
    </main>
  );
}
