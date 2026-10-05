import { PortalNav, RangeFilter, ReportDetails, StarsRow, StatusChip, StudentSelector } from "@/components/parent/ReportParts";
import { requireParent } from "@/server/auth/guards";
import { formatDateShort } from "@/server/lib/dates";
import { parseRange } from "@/server/lib/parent-report";
import { getStudentHistory, selectStudent } from "@/server/services/parent-portal";
import { en } from "@/messages/en";

export const dynamic = "force-dynamic";

const t = en.parent;

export default async function ParentHistory({ searchParams }: { searchParams: Promise<{ student?: string; range?: string }> }) {
  const parent = await requireParent();
  const sp = await searchParams;
  const { students, selected } = await selectStudent(parent.parentId, sp.student);
  if (!selected) return <p className="rounded-xl bg-white p-4">{t.noStudents}</p>;

  const range = parseRange(sp.range);
  const h = await getStudentHistory(parent.parentId, selected.studentId, range);
  const base = "/parent/history";

  return (
    <>
      <PortalNav active="history" studentId={selected.studentId} />
      <StudentSelector students={students} selectedId={selected.studentId} basePath={base} extra={{ range }} />
      <header>
        <h1 className="font-display text-2xl text-ink">{t.history.title}</h1>
        <p className="text-stone-700">{selected.name}</p>
      </header>
      <RangeFilter basePath={base} range={range} studentId={selected.studentId} />

      <p className="text-sm text-stone-700">
        {t.history.summary}:{" "}
        {h.stars.average !== null ? <strong>★ {h.stars.average.toFixed(1)}/5 ({h.stars.ratedDays} {t.ratedDays})</strong> : t.noAverage}
      </p>

      {h.reports.length === 0 ? (
        <p className="rounded-xl bg-white p-4">{t.history.empty}</p>
      ) : (
        <ul className="space-y-2">
          {/* Latest date first. Tap a date to open its details. */}
          {h.reports.map((r) => (
            <li key={r.id}>
              <details className="group rounded-xl border border-stone-300 bg-white open:shadow-sm">
                <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 p-3">
                  <span className="w-24 shrink-0 text-sm font-medium">{formatDateShort(r.date)}</span>
                  <StatusChip status={r.status} />
                  <span className="min-w-0 flex-1 truncate text-sm text-stone-600">{r.note || ""}</span>
                  {r.ack.state !== "acknowledged" && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500" title={r.ack.state === "updated" ? t.ack.updated : t.ack.none} aria-label={r.ack.state === "updated" ? t.ack.updated : t.ack.none} />}
                  <span className="shrink-0 text-sm"><StarsRow value={r.status === "present" ? r.stars : null} /></span>
                </summary>
                <div className="border-t border-stone-200 p-3">
                  <ReportDetails report={r} />
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
