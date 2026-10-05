import StudentsManager from "@/components/admin/StudentsManager";
import { requireWarden } from "@/server/auth/guards";
import { studentQuerySchema } from "@/server/http/schemas";
import { listRooms } from "@/server/services/rooms";
import { searchStudents } from "@/server/services/students";
import { en } from "@/messages/en";

export const dynamic = "force-dynamic";

const t = en.admin.students;

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  await requireWarden();
  const sp = await searchParams;
  const parsed = studentQuerySchema.safeParse({ q: sp.q?.slice(0, 100), status: sp.status });
  const filters = parsed.success ? parsed.data : { status: "active" as const };
  const [students, rooms] = await Promise.all([searchStudents(filters), listRooms()]);
  const status = filters.status;

  const pill = (on: boolean) => `flex h-11 items-center rounded-full px-4 text-sm font-medium ${on ? "bg-ink text-white" : "border border-stone-300 bg-white text-ink"}`;
  const href = (s: string) => `/admin/students?status=${s}${filters.q ? `&q=${encodeURIComponent(filters.q)}` : ""}`;

  return (
    <main className="space-y-4">
      <header>
        <h1 className="font-display text-3xl text-ink">{t.title}</h1>
        <p className="mt-1 max-w-2xl text-stone-700">{t.intro}</p>
      </header>

      <form method="get" action="/admin/students" className="flex gap-2">
        <input type="hidden" name="status" value={status} />
        <input name="q" defaultValue={filters.q ?? ""} placeholder={t.search} aria-label={t.search} className="h-11 flex-1 rounded-lg border border-stone-300 bg-white px-3 text-base" />
        <button className="h-11 rounded-lg bg-ink px-4 text-sm font-semibold text-white">{t.searchBtn}</button>
      </form>
      <nav aria-label={t.status} className="flex flex-wrap gap-2">
        <a href={href("active")} className={pill(status === "active")}>{t.active}</a>
        <a href={href("inactive")} className={pill(status === "inactive")}>{t.inactive}</a>
        <a href={href("all")} className={pill(status === "all")}>{t.all}</a>
        <span className="flex h-11 items-center text-sm text-stone-600">{students.length} {t.count}</span>
      </nav>

      <StudentsManager
        students={students.map((s) => ({ ...s, deactivatedAt: undefined }))}
        rooms={rooms.map((r) => ({ id: r.id, roomNumber: r.roomNumber, capacity: r.capacity, activeStudents: r.activeStudents, isActive: r.isActive }))}
      />
    </main>
  );
}
