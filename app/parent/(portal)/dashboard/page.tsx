import Link from "next/link";
import { PortalNav, ReportDetails, StarsRow, StatusChip, StudentSelector } from "@/components/parent/ReportParts";
import { requireParent } from "@/server/auth/guards";
import { formatDateLong } from "@/server/lib/dates";
import { getPortalOverview } from "@/server/services/parent-portal";
import { en } from "@/messages/en";

export const dynamic = "force-dynamic";

const t = en.parent;

export default async function ParentDashboard({ searchParams }: { searchParams: Promise<{ student?: string }> }) {
  const parent = await requireParent();
  const { student } = await searchParams;
  const o = await getPortalOverview(parent.parentId, student);

  if (!o.selected) return <p className="rounded-xl bg-white p-4">{t.noStudents}</p>;
  const card = "rounded-2xl border border-stone-300 bg-white p-4";
  const sid = o.selected.studentId;

  return (
    <>
      <PortalNav active="dashboard" studentId={sid} />
      <StudentSelector students={o.students} selectedId={sid} basePath="/parent/dashboard" />

      <section className={card}>
        <p className="text-sm text-stone-600">{formatDateLong(o.date ?? "")}</p>
        <h1 className="font-display text-2xl text-ink">{o.selected.name}</h1>
        <p className="text-stone-700">{t.room} {o.selected.roomNumber}</p>
        {!o.isActive && <p className="mt-2 rounded-lg bg-stone-100 p-2 text-sm">{t.inactiveNotice}</p>}
      </section>

      {o.isActive && (
        <section className={card} aria-label={t.today}>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-600">{t.today}</h2>
          {o.today ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <StatusChip status={o.today.status} />
                {o.today.status === "present" && (
                  <p className="text-lg">{t.todaysStars}: <StarsRow value={o.today.stars} /></p>
                )}
                {o.today.status !== "present" && <p className="text-stone-600">{t.todaysStars}: {t.notRated}</p>}
              </div>
              <ReportDetails report={o.today} />
            </div>
          ) : (
            <p className="text-stone-700">{t.notCheckedYet}</p>
          )}
        </section>
      )}

      <section className={card}>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-stone-600">{t.stars}</h2>
        {o.stars.average !== null ? (
          <p className="text-xl">
            {t.average}: <span className="text-amber-500">★</span> {o.stars.average.toFixed(1)}/5
            <span className="ml-2 text-sm text-stone-600">({o.stars.ratedDays} {t.ratedDays})</span>
          </p>
        ) : (
          <p className="text-stone-600">{t.noAverage}</p>
        )}
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link href={`/parent/history?student=${sid}`} className="font-medium text-ink underline">{t.viewHistory}</Link>
          <Link href={`/parent/stars?student=${sid}`} className="font-medium text-ink underline">{t.viewStars}</Link>
        </div>
      </section>

      {o.awaiting > 0 && (
        <Link href={`/parent/history?student=${sid}`} className="block rounded-2xl border border-amber-300 bg-amber-50 p-4 font-medium text-amber-900">
          {o.awaiting} {t.awaiting}
        </Link>
      )}

      <p className="pt-2 text-center text-sm">
        <Link href="/parent/password" className="text-ink underline">{t.nav.password}</Link>
      </p>
    </>
  );
}
