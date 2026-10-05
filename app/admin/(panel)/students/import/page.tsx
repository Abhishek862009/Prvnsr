import CsvImporter from "@/components/admin/CsvImporter";
import { requireWarden } from "@/server/auth/guards";
import { IMPORT_LIMITS } from "@/server/lib/import-format";
import { en } from "@/messages/en";

export const dynamic = "force-dynamic";

export default async function StudentsImportPage() {
  await requireWarden();
  return (
    <main className="max-w-3xl space-y-4">
      <header>
        <h1 className="font-display text-3xl text-ink">{en.admin.import.studentsTitle}</h1>
        <p className="mt-1 text-stone-700">{en.admin.import.studentsIntro}</p>
      </header>
      <CsvImporter
        kind="students"
        previewUrl="/api/admin/students/import/preview"
        commitUrl="/api/admin/students/import/commit"
        sampleUrl="/api/admin/students/import/sample"
        maxBytes={IMPORT_LIMITS.maxBytes}
      />
    </main>
  );
}
