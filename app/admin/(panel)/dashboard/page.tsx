import Link from "next/link";
import { requireWarden } from "@/server/auth/guards";
import { formatDateLong } from "@/server/lib/dates";
import { getDashboard } from "@/server/services/checking";
import { en } from "@/messages/en";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireWarden();
  const d = await getDashboard();
  const t = en.admin.dashboard;
  const { overall } = d;
  const pct = (n: number) => (overall.total ? `${(n / overall.total) * 100}%` : "0%");
  const firstFloor = d.floors[0]?.floor ?? 1;
  const mapFloor = d.continueRoom?.floor ?? firstFloor;

  const card = "flex min-h-20 flex-col justify-center rounded-xl border border-stone-300 bg-white p-4";
  const soon = (label: string) => (
    <div aria-disabled="true" className={`${card} border-dashed text-stone-400`}>
      <span className="font-medium">{label}</span>
      <span className="text-xs">{t.comingSoon}</span>
    </div>
  );

  return (
    <main className="space-y-5">
      <header>
        <p className="text-sm text-stone-600">{formatDateLong(d.date)}</p>
        <h1 className="font-display text-3xl text-ink">{t.title}</h1>
      </header>

      {overall.total === 0 ? (
        <p className="rounded-xl bg-white p-4">{t.noRooms}</p>
      ) : (
        <>
          <section className="rounded-2xl border border-stone-300 bg-white p-4">
            <p className="font-display text-4xl text-ink">
              {overall.completed} <span className="text-stone-400">/ {overall.total}</span>
              <span className="ml-2 font-sans text-base text-stone-600">{t.roomsCompleted}</span>
            </p>
            <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-status-pending/30" role="img" aria-label={`${overall.completed} completed, ${overall.pending} pending, ${overall.vacant} vacant`}>
              <div className="bg-status-complete" style={{ width: pct(overall.completed) }} />
              <div className="bg-status-vacant" style={{ width: pct(overall.vacant) }} />
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div><dd className="text-2xl font-semibold text-status-complete">{overall.completed}</dd><dt className="text-xs text-stone-600">{t.completed}</dt></div>
              <div><dd className="text-2xl font-semibold text-status-pending">{overall.pending}</dd><dt className="text-xs text-stone-600">{t.pending}</dt></div>
              <div><dd className="text-2xl font-semibold text-status-vacant">{overall.vacant}</dd><dt className="text-xs text-stone-600">{t.vacant}</dt></div>
            </dl>
            <h2 className="mb-1 mt-4 text-sm font-semibold text-stone-700">{t.floorWise}</h2>
            <ul className="divide-y divide-stone-200">
              {d.floors.map((f) => (
                <li key={f.floor}>
                  <Link href={`/admin/floors/${f.floor}`} className="flex min-h-11 items-center justify-between">
                    <span>{en.admin.map.floor} {f.floor}</span>
                    <span className="font-medium">{f.completed}/{f.total}{f.vacant > 0 && <span className="ml-2 text-xs font-normal text-stone-500">{f.vacant} {t.vacant.toLowerCase()}</span>}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-ink/30 bg-white p-4">
            {d.continueRoom ? (
              <>
                <p className="text-lg font-medium">{d.hasProgress ? t.continueFrom : t.startFrom} {d.continueRoom.roomNumber}?</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <Link href={`/admin/rooms/${d.continueRoom.roomNumber}/check`} className="flex h-12 items-center rounded-lg bg-ink px-5 font-semibold text-white">{t.continue}</Link>
                  <Link href={`/admin/floors/${mapFloor}`} className="flex h-12 items-center rounded-lg border border-ink px-5 font-semibold text-ink">{t.chooseAnother}</Link>
                </div>
              </>
            ) : (
              <p className="text-lg font-medium text-status-complete">{t.allDone}</p>
            )}
          </section>
        </>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-600">{t.quickActions}</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {d.continueRoom ? (
            <Link href={`/admin/rooms/${d.continueRoom.roomNumber}/check`} className={`${card} font-medium hover:border-ink`}>{t.continueChecking}</Link>
          ) : (
            soon(t.continueChecking)
          )}
          <Link href={`/admin/floors/${mapFloor}`} className={`${card} font-medium hover:border-ink`}>{t.floorMap}</Link>
          <Link href="/admin/search" className={`${card} font-medium hover:border-ink`}>{t.searchStudent}</Link>
          <Link href="/admin/reports" className={`${card} font-medium hover:border-ink`}>{t.todaysReports}</Link>
          <Link href="/admin/history" className={`${card} font-medium hover:border-ink`}>{t.history}</Link>
          <Link href="/admin/backup" className={`${card} font-medium hover:border-ink`}>{t.backup}</Link>
        </div>
      </section>
    </main>
  );
}
