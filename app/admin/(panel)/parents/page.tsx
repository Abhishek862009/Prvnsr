import ParentManager from "@/components/admin/ParentManager";
import { requireWarden } from "@/server/auth/guards";
import { getParentManagement } from "@/server/services/parent-admin";
import { en } from "@/messages/en";

export const dynamic = "force-dynamic";

export default async function ParentsPage() {
  await requireWarden();
  const d = await getParentManagement();
  return (
    <main className="max-w-3xl space-y-4">
      <header>
        <h1 className="font-display text-3xl text-ink">{en.admin.parents.title}</h1>
        <p className="mt-1 text-stone-700">{en.admin.parents.intro}</p>
      </header>
      <ParentManager
        parents={d.parents.map((p) => ({ ...p, lastLoginAt: p.lastLoginAt ? p.lastLoginAt.toISOString() : null }))}
        students={d.students}
        linkedStudentIds={d.linkedStudentIds}
      />
    </main>
  );
}
