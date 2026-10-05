import BackupPanel from "@/components/admin/BackupPanel";
import { requireWarden } from "@/server/auth/guards";
import { en } from "@/messages/en";

export const dynamic = "force-dynamic";

export default async function BackupPage() {
  await requireWarden();
  return (
    <main className="max-w-2xl space-y-4">
      <h1 className="font-display text-3xl text-ink">{en.admin.backup.title}</h1>
      <BackupPanel />
    </main>
  );
}
