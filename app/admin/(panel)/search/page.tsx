import Link from "next/link";
import { requireWarden } from "@/server/auth/guards";
import { wardenSearch } from "@/server/services/search";
import { en } from "@/messages/en";

export const dynamic = "force-dynamic";

const t = en.admin.search;
const BG = { complete: "bg-status-complete", pending: "bg-status-pending", vacant: "bg-status-vacant" } as const;
const LABEL = { complete: t.statusComplete, pending: t.statusPending, vacant: t.statusVacant } as const;

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; inactive?: string }> }) {
  await requireWarden();
  const sp = await searchParams;
  const includeInactive = sp.inactive === "1";
  const r = await wardenSearch(sp.q ?? "", includeInactive);

  return (
    <main className="space-y-4">
      <header>
        <h1 className="font-display text-3xl text-ink">{t.title}</h1>
        <p className="mt-1 text-stone-700">{t.intro}</p>
      </header>

      <form method="get" action="/admin/search" className="space-y-2">
        <div className="flex gap-2">
          <input name="q" defaultValue={sp.q ?? ""} placeholder={t.placeholder} aria-label={t.title} autoFocus className="h-12 flex-1 rounded-lg border border-stone-300 bg-white px-3 text-base outline-none focus:border-ink focus:ring-2 focus:ring-ink/20" />
          <button className="h-12 rounded-lg bg-ink px-5 text-base font-semibold text-white">{t.go}</button>
        </div>
        <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="inactive" value="1" defaultChecked={includeInactive} className="h-5 w-5" />{t.includeInactive}</label>
      </form>
      <p className="text-xs text-stone-500">{t.hint}</p>

      {r.kind !== "empty" && r.rooms.length === 0 && r.students.length === 0 && <p className="rounded-xl bg-white p-4">{t.none}</p>}

      {r.rooms.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-600">{t.rooms}</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {r.rooms.map((room) => (
              <li key={room.id}>
                <Link href={`/admin/rooms/${room.roomNumber}/check`} className={`flex items-center justify-between rounded-xl p-4 text-white ${BG[room.status]}`} aria-label={`Room ${room.roomNumber}, ${LABEL[room.status]}`}>
                  <span><span className="block text-2xl font-bold">{room.roomNumber}</span><span className="text-sm">{room.activeStudents} {t.activeStudents}</span></span>
                  <span className="text-sm font-medium underline">{t.openRoom}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {r.students.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-600">{t.students} ({r.students.length})</h2>
          <ul className="space-y-2">
            {r.students.map((s) => (
              <li key={s.id} className="rounded-xl border border-stone-300 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-lg font-semibold">{s.name} {!s.isActive && <span className="ml-1 rounded-full bg-stone-200 px-2 py-0.5 text-xs font-medium">{t.inactive}</span>}</p>
                    <p className="text-sm text-stone-600">{t.room} {s.roomNumber}{s.studentCode ? ` · ${s.studentCode}` : ""}</p>
                    <p className="text-sm text-stone-600">{t.parent}: {s.parentName ? `${s.parentName} · ` : ""}{s.parentWhatsapp ?? "-"}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-sm font-medium">
                    {s.isActive && <Link href={`/admin/rooms/${s.roomNumber}/check`} className="text-ink underline">{t.openRoom}</Link>}
                    <Link href={`/admin/students?q=${encodeURIComponent(s.studentCode ?? s.name)}&status=all`} className="text-ink underline">{t.manage}</Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
