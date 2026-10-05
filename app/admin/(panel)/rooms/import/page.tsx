import CsvImporter from "@/components/admin/CsvImporter";
import { requireWarden } from "@/server/auth/guards";
import { ROOM_IMPORT_LIMITS } from "@/server/lib/room-import-format";
import { en } from "@/messages/en";

export const dynamic = "force-dynamic";

export default async function RoomsImportPage() {
  await requireWarden();
  return (
    <main className="max-w-3xl space-y-4">
      <header>
        <h1 className="font-display text-3xl text-ink">{en.admin.import.roomsTitle}</h1>
        <p className="mt-1 text-stone-700">{en.admin.import.roomsIntro}</p>
      </header>
      <CsvImporter
        kind="rooms"
        modes
        previewUrl="/api/admin/rooms/import/preview"
        commitUrl="/api/admin/rooms/import/commit"
        sampleUrl="/api/admin/rooms/import/sample"
        maxBytes={ROOM_IMPORT_LIMITS.maxBytes}
      />
    </main>
  );
}
