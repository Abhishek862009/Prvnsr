import Link from "next/link";
import WhatsAppButton from "@/components/admin/WhatsAppButton";
import { requireWarden } from "@/server/auth/guards";
import { getEnv } from "@/server/config/env";
import { formatDateLong, formatDateTimeInZone } from "@/server/lib/dates";
import { reportFilterSchema } from "@/server/http/schemas";
import { getTodaysReports } from "@/server/services/reports";
import { en } from "@/messages/en";

export const dynamic = "force-dynamic";

const t = en.admin.reports;
const CHIP = { present: "bg-status-complete text-white", absent: "bg-status-pending text-white", other: "bg-amber-700 text-white" } as const;

export default async function TodaysReportsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  await requireWarden();
  const filter = reportFilterSchema.parse((await searchParams).filter ?? "all");
  const data = await getTodaysReports(filter);
  const tz = getEnv().APP_TIMEZONE;
  const { summary } = data;

  const pill = (on: boolean) => `flex h-11 items-center rounded-full px-4 text-sm font-medium ${on ? "bg-ink text-white" : "border border-stone-300 bg-white text-ink"}`;

  return (
    <main className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm text-stone-600">{formatDateLong(data.date)}</p>
          <h1 className="font-display text-3xl text-ink">{t.title}</h1>
        </div>
        <Link href="/admin/dashboard" className="text-sm text-ink underline">{t.back}</Link>
      </header>

      <p className="rounded-xl bg-white p-3 text-sm text-stone-700">{t.honestNote}</p>

      <dl className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
        <div className="rounded-xl bg-white p-3"><dd className="text-2xl font-semibold">{summary.total}</dd><dt className="text-xs text-stone-600">{t.total}</dt></div>
        <div className="rounded-xl bg-white p-3"><dd className="text-2xl font-semibold text-status-complete">{summary.opened}</dd><dt className="text-xs text-stone-600">{t.opened}</dt></div>
        <div className="rounded-xl bg-white p-3"><dd className="text-2xl font-semibold text-status-vacant">{summary.notOpened}</dd><dt className="text-xs text-stone-600">{t.notOpened}</dt></div>
        <div className="rounded-xl bg-white p-3"><dd className="text-2xl font-semibold text-amber-700">{summary.editedAfter}</dd><dt className="text-xs text-stone-600">{t.editedAfter}</dt></div>
      </dl>

      <nav aria-label="Filter" className="flex flex-wrap gap-2">
        <Link href="/admin/reports" aria-current={filter === "all" ? "page" : undefined} className={pill(filter === "all")}>{t.filterAll} ({summary.total})</Link>
        <Link href="/admin/reports?filter=needs_whatsapp" aria-current={filter === "needs_whatsapp" ? "page" : undefined} className={pill(filter === "needs_whatsapp")}>{t.filterNeeds} ({summary.needsWhatsApp})</Link>
      </nav>

      {data.rows.length === 0 ? (
        <p className="rounded-xl bg-white p-4">{filter === "needs_whatsapp" && summary.total > 0 ? t.emptyNeeds : t.emptyAll}</p>
      ) : (
        <ul className="space-y-3">
          {data.rows.map((r) => {
            const w = r.whatsapp;
            const label = w.state === "edited_after" ? t.whatsappUpdated : w.state === "opened" ? t.whatsappAgain : t.whatsapp;
            return (
              <li key={r.checkId} className="rounded-xl border border-stone-300 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold">{r.studentName} <span className="font-normal text-stone-600">· Room {r.roomNumber}</span></h2>
                  <span className={`rounded-full px-3 py-0.5 text-sm font-medium ${CHIP[r.status]}`}>{en.parent.status[r.status]}</span>
                </div>

                <p className="mt-1 text-sm">
                  {r.status === "present" && r.stars !== null ? (
                    <span><span className="text-amber-500">{"★".repeat(r.stars)}</span><span className="text-stone-300">{"★".repeat(5 - r.stars)}</span> {r.stars}/5</span>
                  ) : (
                    <span className="text-stone-500">{t.notRated}</span>
                  )}
                </p>
                <p className="mt-1 line-clamp-2 text-sm text-stone-700">{r.note || <span className="text-stone-500">{t.noteNone}</span>}</p>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  {w.state === "not_opened" && <span className="rounded-full bg-stone-200 px-2.5 py-0.5 font-medium text-stone-700">{t.notOpened}</span>}
                  {w.state === "opened" && (
                    <span className="rounded-full bg-green-100 px-2.5 py-0.5 font-medium text-green-900">{t.opened}{w.openedAt ? ` · ${formatDateTimeInZone(w.openedAt, tz)}` : ""}</span>
                  )}
                  {w.state === "edited_after" && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 font-medium text-amber-900">{t.editedAfter}</span>}
                </div>

                <div className="mt-3">
                  <WhatsAppButton href={w.url} checkId={r.checkId} revision={r.revision} label={label} reason={w.reason} />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {[t.email, t.sms].map((ch) => (
                    <button key={ch} type="button" disabled className="flex h-10 cursor-not-allowed items-center gap-2 rounded-lg border border-dashed border-stone-300 px-3 text-sm text-stone-400">
                      {ch} <span className="text-xs">{t.unavailable}</span>
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
