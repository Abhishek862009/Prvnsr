import Link from "next/link";
import { requireWarden } from "@/server/auth/guards";
import { getEnv } from "@/server/config/env";
import { formatDateShort, formatDateTimeInZone } from "@/server/lib/dates";
import type { HistoryFilters, HistoryRow } from "@/server/lib/history";
import { getWardenHistory } from "@/server/services/history";
import { en } from "@/messages/en";

export const dynamic = "force-dynamic";

const t = en.admin.history;
const CHIP = { present: "bg-status-complete text-white", absent: "bg-status-pending text-white", other: "bg-amber-700 text-white" } as const;
const STATUS_LABEL = { present: t.present, absent: t.absent, other: t.other } as const;

function Stars({ row }: { row: HistoryRow }) {
  if (row.status !== "present" || row.stars === null) return <span className="text-stone-500">{t.notRated}</span>;
  return (
    <span aria-label={`${row.stars} out of 5 stars`}>
      <span className="text-amber-500">{"★".repeat(row.stars)}</span>
      <span className="text-stone-300">{"★".repeat(5 - row.stars)}</span> <span className="text-xs">{row.stars}/5</span>
    </span>
  );
}

function Badges({ row, tz }: { row: HistoryRow; tz: string }) {
  const w = row.whatsapp;
  const a = row.ack;
  return (
    <div className="flex flex-wrap gap-1.5 text-xs">
      {w.state === "not_opened" && <span className="rounded-full bg-stone-200 px-2 py-0.5">{t.whatsapp}: {t.notOpened}</span>}
      {w.state === "opened" && <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-900">{t.whatsapp}: {t.opened}{w.openedAt ? ` · ${formatDateTimeInZone(w.openedAt, tz)}` : ""}</span>}
      {w.state === "edited_after" && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900">{t.whatsapp}: {t.editedAfter}</span>}
      {a.state === "acknowledged" && <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-900">{t.ack}: {t.seen}{a.at ? ` · ${formatDateTimeInZone(a.at, tz)}` : ""}</span>}
      {a.state === "updated" && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900">{t.ack}: {t.older}</span>}
      {a.state === "none" && <span className="rounded-full bg-stone-200 px-2 py-0.5">{t.ack}: {t.notSeen}</span>}
      {row.lastEditedAt && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900">{t.edited} · {t.revision} {row.revision} · {formatDateTimeInZone(row.lastEditedAt, tz)}</span>}
    </div>
  );
}

function Detail({ row }: { row: HistoryRow }) {
  return (
    <div className="space-y-1 text-sm">
      <p><span className="text-xs font-semibold uppercase text-stone-500">{t.studentNote}: </span>{row.note || <span className="text-stone-500">{t.noNote}</span>}</p>
      {row.roomNote && <p className="rounded bg-stone-50 p-2"><span className="text-xs font-semibold uppercase text-stone-500">{t.roomNote}: </span>{row.roomNote}</p>}
    </div>
  );
}

const Chip = ({ s }: { s: HistoryRow["status"] }) => <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${CHIP[s]}`}>{STATUS_LABEL[s]}</span>;

function qs(f: HistoryFilters, over: Partial<Record<string, string | number>> = {}) {
  const p = new URLSearchParams();
  const base: Record<string, string> = { view: f.view, from: f.from, to: f.to, room: f.room ?? "", q: f.q, status: f.status ?? "", stars: f.stars === null ? "" : String(f.stars), page: String(f.page) };
  for (const [k, v] of Object.entries({ ...base, ...over })) if (String(v) !== "") p.set(k, String(v));
  return `/admin/history?${p.toString()}`;
}

export default async function HistoryPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireWarden();
  const data = await getWardenHistory(await searchParams);
  const { filters: f, result, totals, roomOptions } = data;
  const tz = getEnv().APP_TIMEZONE;
  const field = "mt-1 h-11 w-full rounded-lg border border-stone-300 bg-white px-2 text-sm";
  const tab = (on: boolean) => `flex h-11 items-center rounded-full px-4 text-sm font-medium ${on ? "bg-ink text-white" : "border border-stone-300 bg-white text-ink"}`;

  return (
    <main className="space-y-4">
      <header>
        <h1 className="font-display text-3xl text-ink">{t.title}</h1>
        <p className="mt-1 text-stone-700">{t.intro}</p>
      </header>

      <nav aria-label="View" className="flex flex-wrap gap-2">
        <Link href={qs(f, { view: "date", page: 1 })} className={tab(f.view === "date")}>{t.viewDate}</Link>
        <Link href={qs(f, { view: "student", page: 1 })} className={tab(f.view === "student")}>{t.viewStudent}</Link>
        <Link href={qs(f, { view: "room", page: 1 })} className={tab(f.view === "room")}>{t.viewRoom}</Link>
      </nav>

      <form method="get" action="/admin/history" className="grid gap-3 rounded-xl border border-stone-300 bg-white p-3 sm:grid-cols-3 lg:grid-cols-6">
        <input type="hidden" name="view" value={f.view} />
        <label className="text-xs font-medium">{t.from}<input className={field} type="date" name="from" defaultValue={f.from} /></label>
        <label className="text-xs font-medium">{t.to}<input className={field} type="date" name="to" defaultValue={f.to} /></label>
        <label className="text-xs font-medium">{t.room}
          <select className={field} name="room" defaultValue={f.room ?? ""}><option value="">{t.anyRoom}</option>{roomOptions.map((r) => <option key={r} value={r}>{r}</option>)}</select>
        </label>
        <label className="text-xs font-medium">{t.student}<input className={field} name="q" defaultValue={f.q} maxLength={60} /></label>
        <label className="text-xs font-medium">{t.status}
          <select className={field} name="status" defaultValue={f.status ?? ""}><option value="">{t.anyStatus}</option><option value="present">{t.present}</option><option value="absent">{t.absent}</option><option value="other">{t.other}</option></select>
        </label>
        <label className="text-xs font-medium">{t.stars}
          <select className={field} name="stars" defaultValue={f.stars === null ? "" : String(f.stars)}><option value="">{t.anyStars}</option>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} ★</option>)}<option value="none">{t.notRated}</option></select>
        </label>
        <div className="flex items-end gap-2 sm:col-span-3 lg:col-span-6">
          <button className="h-11 rounded-lg bg-ink px-5 text-sm font-semibold text-white">{t.apply}</button>
          <Link href={`/admin/history?view=${f.view}`} className="flex h-11 items-center rounded-lg border border-stone-300 px-4 text-sm">{t.reset}</Link>
          <span className="ml-auto text-sm text-stone-600">{formatDateShort(f.from)} – {formatDateShort(f.to)} · {totals.reports} {t.reports} · {totals.students} {t.studentsCount} · {totals.rooms} {t.roomsCount}</span>
        </div>
      </form>

      {result.total === 0 && <p className="rounded-xl bg-white p-4">{t.empty}</p>}

      {result.view === "date" && (
        <ul className="space-y-2">
          {result.items.map((r) => (
            <li key={r.id} className="rounded-xl border border-stone-300 bg-white p-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-sm font-semibold">{formatDateShort(r.date)}</span>
                <span className="text-sm">{t.room} {r.roomNumber}</span>
                <span className="font-medium">{r.studentName}{r.studentCode ? <span className="ml-1 text-xs font-normal text-stone-500">{r.studentCode}</span> : null}{!r.studentActive && <span className="ml-1 rounded-full bg-stone-200 px-1.5 text-[11px]">{t.inactive}</span>}</span>
                <Chip s={r.status} /><Stars row={r} />
              </div>
              <div className="mt-2 space-y-2"><Detail row={r} /><Badges row={r} tz={tz} /></div>
            </li>
          ))}
        </ul>
      )}

      {result.view === "student" && (
        <ul className="space-y-2">
          {result.items.map((g) => (
            <li key={g.studentId}>
              <details className="rounded-xl border border-stone-300 bg-white">
                <summary className="flex min-h-14 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 p-3">
                  <span className="font-semibold">{g.name}{g.code && <span className="ml-1 text-xs font-normal text-stone-500">{g.code}</span>}{!g.active && <span className="ml-1 rounded-full bg-stone-200 px-1.5 text-[11px]">{t.inactive}</span>}</span>
                  <span className="text-sm text-stone-600">{t.room} {g.rooms.join(", ")}</span>
                  <span className="text-sm">{g.summary.days} {t.days} · {g.summary.present} {t.present} · {g.summary.absent} {t.absent} · {g.summary.other} {t.other}</span>
                  <span className="text-sm">{t.average}: {g.summary.average !== null ? `★ ${g.summary.average.toFixed(1)}/5 (${g.summary.ratedDays})` : t.notRated}</span>
                </summary>
                <ul className="divide-y divide-stone-100 border-t border-stone-200">
                  {g.rows.map((r) => (
                    <li key={r.id} className="space-y-2 p-3">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="text-sm font-semibold">{formatDateShort(r.date)}</span><span className="text-sm">{t.room} {r.roomNumber}</span><Chip s={r.status} /><Stars row={r} /></div>
                      <Detail row={r} /><Badges row={r} tz={tz} />
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ))}
        </ul>
      )}

      {result.view === "room" && (
        <ul className="space-y-2">
          {result.items.map((g) => (
            <li key={g.roomNumber}>
              <details className="rounded-xl border border-stone-300 bg-white">
                <summary className="flex min-h-14 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 p-3">
                  <span className="text-lg font-semibold">{t.room} {g.roomNumber}</span>
                  <span className="text-sm">{g.summary.days} {t.reports} · {g.summary.present} {t.present} · {g.summary.absent} {t.absent} · {g.summary.other} {t.other}</span>
                  <span className="text-sm">{t.average}: {g.summary.average !== null ? `★ ${g.summary.average.toFixed(1)}/5` : t.notRated}</span>
                </summary>
                <div className="divide-y divide-stone-100 border-t border-stone-200">
                  {g.days.map((d) => (
                    <div key={d.date} className="space-y-2 p-3">
                      <p className="text-sm font-semibold">{formatDateShort(d.date)}</p>
                      {d.roomNote && <p className="rounded bg-stone-50 p-2 text-sm"><span className="text-xs font-semibold uppercase text-stone-500">{t.roomNote}: </span>{d.roomNote}</p>}
                      <ul className="space-y-2">
                        {d.rows.map((r) => (
                          <li key={r.id} className="space-y-1 rounded-lg border border-stone-200 p-2">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="font-medium">{r.studentName}</span><Chip s={r.status} /><Stars row={r} /></div>
                            <p className="text-sm">{r.note || <span className="text-stone-500">{t.noNote}</span>}</p>
                            <Badges row={r} tz={tz} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}

      {result.pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between">
          {result.page > 1 ? <Link href={qs(f, { page: result.page - 1 })} className={tab(false)}>{t.prev}</Link> : <span />}
          <span className="text-sm text-stone-600">{t.page} {result.page} / {result.pages}</span>
          {result.page < result.pages ? <Link href={qs(f, { page: result.page + 1 })} className={tab(false)}>{t.next}</Link> : <span />}
        </nav>
      )}
    </main>
  );
}
