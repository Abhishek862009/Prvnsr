import Link from "next/link";
import EnquiryActions from "@/components/admin/EnquiryActions";
import { requireWarden } from "@/server/auth/guards";
import { getEnv } from "@/server/config/env";
import { formatDateTimeInZone } from "@/server/lib/dates";
import { ROOM_TYPE_LABEL, type RoomType } from "@/server/lib/enquiry";
import { enquiryListQuerySchema } from "@/server/http/schemas";
import { enquiryCounts, listEnquiries } from "@/server/services/enquiries";
import { en } from "@/messages/en";

export const dynamic = "force-dynamic";

const t = en.admin.enquiries;
const BADGE = { new: "bg-amber-100 text-amber-900", contacted: "bg-blue-100 text-blue-900", closed: "bg-stone-200 text-stone-700" } as const;

export default async function EnquiriesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireWarden();
  const status = enquiryListQuerySchema.parse((await searchParams).status);
  const [list, counts] = await Promise.all([listEnquiries(status), enquiryCounts()]);
  const tz = getEnv().APP_TIMEZONE;
  const total = counts.new + counts.contacted + counts.closed;

  const pill = (on: boolean) => `flex h-11 items-center rounded-full px-4 text-sm font-medium ${on ? "bg-ink text-white" : "border border-stone-300 bg-white text-ink"}`;
  return (
    <main className="space-y-4">
      <header>
        <h1 className="font-display text-3xl text-ink">{t.title}</h1>
        <p className="text-sm text-stone-600">{t.retention}</p>
      </header>

      <nav aria-label="Status" className="flex flex-wrap gap-2">
        <Link href="/admin/enquiries" className={pill(!status)}>{t.all} ({total})</Link>
        {(["new", "contacted", "closed"] as const).map((s) => (
          <Link key={s} href={`/admin/enquiries?status=${s}`} className={pill(status === s)}>{t[s]} ({counts[s]})</Link>
        ))}
      </nav>

      {list.length === 0 ? (
        <p className="rounded-xl bg-white p-4">{t.empty}</p>
      ) : (
        <ul className="space-y-3">
          {list.map((e) => (
            <li key={e.id} className="rounded-xl border border-stone-300 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">{e.name}</h2>
                <span className={`rounded-full px-3 py-0.5 text-sm font-medium ${BADGE[e.status]}`}>{t[e.status]}</span>
              </div>
              <p className="mt-1"><a href={`tel:${e.phone}`} className="font-medium text-ink underline">{e.phone}</a>{e.email && <span className="ml-3 text-sm text-stone-600">{t.email}: {e.email}</span>}</p>
              <p className="mt-1 text-sm text-stone-700">
                {t.roomType}: {ROOM_TYPE_LABEL[e.preferredRoomType as RoomType] ?? e.preferredRoomType ?? "-"} · {t.joining}: {e.expectedJoiningDate ?? "-"} · {t.received}: {formatDateTimeInZone(e.createdAt, tz)}
              </p>
              {e.message && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-stone-50 p-3 text-sm">{e.message}</p>}
              <div className="mt-3"><EnquiryActions id={e.id} status={e.status} /></div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
