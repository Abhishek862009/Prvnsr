import Link from "next/link";
import { notFound } from "next/navigation";
import FloorPlan, { RoomGrid, StatusIcon } from "@/components/admin/FloorPlan";
import { requireWarden } from "@/server/auth/guards";
import { formatDateLong } from "@/server/lib/dates";
import { getFloorMap } from "@/server/services/checking";
import { en } from "@/messages/en";

export const dynamic = "force-dynamic";

export default async function FloorPage({ params }: { params: Promise<{ floor: string }> }) {
  await requireWarden();
  const raw = (await params).floor;
  if (!/^\d{1,2}$/.test(raw)) notFound();
  const map = await getFloorMap(Number(raw));
  if (!map.floors.includes(map.floor)) notFound();
  const t = en.admin.map;

  const legend = [
    { status: "complete", label: t.legendComplete, bg: "bg-status-complete" },
    { status: "pending", label: t.legendPending, bg: "bg-status-pending" },
    { status: "vacant", label: t.legendVacant, bg: "bg-status-vacant" },
  ] as const;

  return (
    <main className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm text-stone-600">{formatDateLong(map.date)}</p>
          <h1 className="font-display text-3xl text-ink">{t.floor} {map.floor}</h1>
        </div>
        <Link href="/admin/dashboard" className="text-sm text-ink underline">{t.back}</Link>
      </header>

      <nav aria-label="Floors" className="flex flex-wrap gap-2">
        {map.floors.map((f) => (
          <Link key={f} href={`/admin/floors/${f}`} aria-current={f === map.floor ? "page" : undefined} className={`flex h-12 min-w-12 items-center justify-center rounded-full px-4 font-semibold ${f === map.floor ? "bg-ink text-white" : "border border-stone-300 bg-white text-ink"}`}>
            {f}
          </Link>
        ))}
      </nav>

      <ul className="flex flex-wrap gap-3 text-sm" aria-label="Legend">
        {legend.map((l) => (
          <li key={l.status} className="flex items-center gap-1.5">
            <span className={`flex h-6 w-6 items-center justify-center rounded text-white ${l.bg}`}><StatusIcon status={l.status} className="h-4 w-4" /></span>
            {l.label}
          </li>
        ))}
      </ul>

      {map.layout ? <FloorPlan layout={map.layout} tiles={map.tiles} /> : <p className="rounded-xl bg-white p-3 text-sm text-stone-600">{t.noLayout}</p>}

      {map.unplaced.length > 0 && (
        <section>
          {map.layout && <h2 className="mb-2 text-sm font-semibold text-stone-700">{t.otherRooms}</h2>}
          <RoomGrid tiles={map.unplaced} />
        </section>
      )}
    </main>
  );
}
