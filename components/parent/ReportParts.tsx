import Link from "next/link";
import { getEnv } from "@/server/config/env";
import { formatDateTimeInZone } from "@/server/lib/dates";
import type { ParentReport } from "@/server/services/parent-portal";
import { en } from "@/messages/en";
import AcknowledgeButton from "./AcknowledgeButton";

const t = en.parent;

export function StarsRow({ value }: { value: number | null }) {
  if (value === null) return <span className="text-stone-500">{t.notRated}</span>;
  return (
    <span aria-label={`${value} out of 5 stars`}>
      <span className="text-amber-500" aria-hidden="true">{"★".repeat(value)}</span>
      <span className="text-stone-300" aria-hidden="true">{"★".repeat(5 - value)}</span>
      <span className="ml-1 text-sm text-stone-700">{value}/5</span>
    </span>
  );
}

const CHIP = {
  present: "bg-status-complete text-white",
  absent: "bg-status-pending text-white",
  other: "bg-amber-700 text-white",
} as const;

export function StatusChip({ status }: { status: ParentReport["status"] }) {
  return <span className={`inline-block rounded-full px-3 py-0.5 text-sm font-medium ${CHIP[status]}`}>{t.status[status]}</span>;
}

/** "Seen" with time, "Updated — Please acknowledge again", or the Acknowledge / Seen button. */
export function AckBlock({ report }: { report: ParentReport }) {
  const { state, at } = report.ack;
  const tz = getEnv().APP_TIMEZONE;
  if (state === "acknowledged") {
    return <p className="text-sm font-medium text-status-complete">✓ {t.ack.seen}{at ? ` · ${formatDateTimeInZone(at, tz)}` : ""}</p>;
  }
  return (
    <div className="space-y-2">
      {state === "updated" && <p className="rounded-lg bg-amber-50 p-2 text-sm font-medium text-amber-900">{t.ack.updated}</p>}
      <AcknowledgeButton checkId={report.id} revision={report.revision} />
    </div>
  );
}

/** Student note and room note are always shown as separate blocks. */
export function ReportDetails({ report }: { report: ParentReport }) {
  const tz = getEnv().APP_TIMEZONE;
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{t.studentNote}</p>
        <p className="whitespace-pre-wrap">{report.note || <span className="text-stone-500">{t.noNote}</span>}</p>
      </div>
      {report.roomNote && (
        <div className="rounded-lg bg-stone-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{t.roomNote} <span className="font-normal normal-case">· {t.roomNoteHint}</span></p>
          <p className="whitespace-pre-wrap">{report.roomNote}</p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span>{t.room} {report.roomNumber}</span>
        <span>{t.stars}: <StarsRow value={report.status === "present" ? report.stars : null} /></span>
        {report.editedAt && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">{t.edited} · {formatDateTimeInZone(report.editedAt, tz)}</span>}
      </div>
      <AckBlock report={report} />
    </div>
  );
}

export function StudentSelector({
  students,
  selectedId,
  basePath,
  extra,
}: {
  students: { studentId: string; name: string }[];
  selectedId: string;
  basePath: string;
  extra?: Record<string, string>;
}) {
  if (students.length < 2) return null;
  return (
    <nav aria-label={t.student} className="flex flex-wrap gap-2">
      {students.map((s) => {
        const qs = new URLSearchParams({ ...extra, student: s.studentId }).toString();
        const on = s.studentId === selectedId;
        return (
          <Link key={s.studentId} href={`${basePath}?${qs}`} aria-current={on ? "page" : undefined} className={`flex h-12 items-center rounded-full px-4 font-medium ${on ? "bg-ink text-white" : "border border-stone-300 bg-white text-ink"}`}>
            {s.name}
          </Link>
        );
      })}
    </nav>
  );
}

export function PortalNav({ active, studentId }: { active: "dashboard" | "history" | "stars"; studentId?: string }) {
  const q = studentId ? `?student=${studentId}` : "";
  const items = [
    { key: "dashboard", href: `/parent/dashboard${q}`, label: t.nav.dashboard },
    { key: "history", href: `/parent/history${q}`, label: t.nav.history },
    { key: "stars", href: `/parent/stars${q}`, label: t.nav.stars },
  ] as const;
  return (
    <nav aria-label="Portal" className="grid grid-cols-3 gap-1 rounded-xl bg-stone-200/70 p-1">
      {items.map((i) => (
        <Link key={i.key} href={i.href} aria-current={i.key === active ? "page" : undefined} className={`flex h-11 items-center justify-center rounded-lg text-sm font-semibold ${i.key === active ? "bg-white text-ink shadow-sm" : "text-stone-700"}`}>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

export function RangeFilter({ basePath, range, studentId }: { basePath: string; range: string; studentId: string }) {
  const options = [
    { value: "7", label: t.history.range7 },
    { value: "30", label: t.history.range30 },
    { value: "all", label: t.history.rangeAll },
  ];
  return (
    <nav aria-label="Period" className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Link key={o.value} href={`${basePath}?student=${studentId}&range=${o.value}`} aria-current={o.value === range ? "page" : undefined} className={`flex h-11 items-center rounded-full px-4 text-sm font-medium ${o.value === range ? "bg-ink text-white" : "border border-stone-300 bg-white text-ink"}`}>
          {o.label}
        </Link>
      ))}
    </nav>
  );
}
