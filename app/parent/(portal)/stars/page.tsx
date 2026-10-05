import { PortalNav, RangeFilter, StarsRow, StudentSelector } from "@/components/parent/ReportParts";
import StarTrend from "@/components/parent/StarTrend";
import { requireParent } from "@/server/auth/guards";
import { formatDateShort } from "@/server/lib/dates";
import { parseRange } from "@/server/lib/parent-report";
import { getStudentStars, selectStudent } from "@/server/services/parent-portal";
import { en } from "@/messages/en";

export const dynamic = "force-dynamic";

const t = en.parent;

export default async function ParentStars({ searchParams }: { searchParams: Promise<{ student?: string; range?: string }> }) {
  const parent = await requireParent();
  const sp = await searchParams;
  const { students, selected } = await selectStudent(parent.parentId, sp.student);
  if (!selected) return <p className="rounded-xl bg-white p-4">{t.noStudents}</p>;

  const range = parseRange(sp.range);
  const s = await getStudentStars(parent.parentId, selected.studentId, range);
  const base = "/parent/stars";
  const card = "rounded-2xl border border-stone-300 bg-white p-4";

  return (
    <>
      <PortalNav active="stars" studentId={selected.studentId} />
      <StudentSelector students={students} selectedId={selected.studentId} basePath={base} extra={{ range }} />
      <header>
        <h1 className="font-display text-2xl text-ink">{t.starsPage.title}</h1>
        <p className="text-stone-700">{selected.name}</p>
      </header>
      <RangeFilter basePath={base} range={range} studentId={selected.studentId} />

      <section className={card}>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">{t.starsPage.summary}</h2>
        {s.stars.average !== null ? (
          <p className="mt-1 text-2xl">
            {t.average}: <span className="text-amber-500">★</span> {s.stars.average.toFixed(1)}/5
            <span className="ml-2 text-sm text-stone-600">({s.stars.ratedDays} {t.ratedDays})</span>
          </p>
        ) : (
          <p className="mt-1 text-stone-600">{t.noAverage}</p>
        )}
      </section>

      <section className={card}>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-600">{t.starsPage.trend}</h2>
        <StarTrend points={s.trend} />
      </section>

      <section className={card}>
        {s.reports.length === 0 ? (
          <p>{t.history.empty}</p>
        ) : (
          <table className="w-full text-left">
            <thead className="text-xs uppercase tracking-wide text-stone-500">
              <tr><th className="pb-2 font-semibold">{t.starsPage.date}</th><th className="pb-2 font-semibold">{t.starsPage.stars}</th></tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {s.reports.map((r) => (
                <tr key={r.id}>
                  <td className="py-2">{formatDateShort(r.date)}</td>
                  <td className="py-2"><StarsRow value={r.status === "present" ? r.stars : null} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
