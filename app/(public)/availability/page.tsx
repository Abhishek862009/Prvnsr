import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/public/PageHeader";
import { groupRoomsByFloor } from "@/server/lib/public-data";
import { getPublicAvailabilitySafe } from "@/server/services/public-site";

export const metadata: Metadata = { title: "Room Availability" };
// Always rendered fresh: a manual refresh must show the Warden's latest change. No polling.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AvailabilityPage() {
  const data = await getPublicAvailabilitySafe();
  const floors = data ? groupRoomsByFloor(data.rooms) : [];

  return (
    <>
      <PageHeader title="Room availability" intro="Exact room numbers and their current status. Refresh the page to see the latest update." />
      <section className="mx-auto max-w-6xl px-4 py-10">
        {!data && <p className="rounded-xl bg-white p-4">Availability could not be loaded right now. Please refresh, or call us.</p>}
        {data && data.rooms.length === 0 && <p className="rounded-xl bg-white p-4">No rooms are listed yet. Please contact us for availability.</p>}

        {floors.length > 0 && (
          <ul className="mb-6 flex flex-wrap gap-4 text-sm" aria-label="Legend">
            <li className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded bg-status-complete text-white" aria-hidden="true">✓</span> Available</li>
            <li className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded bg-stone-500 text-white" aria-hidden="true">×</span> Full</li>
          </ul>
        )}

        <div className="space-y-8">
          {floors.map((f) => (
            <div key={f.floor}>
              <h2 className="mb-3 font-display text-2xl text-ink">Floor {f.floor}</h2>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {f.rooms.map((r) => (
                  <li key={r.roomNumber} className={`flex items-center justify-between rounded-xl border p-4 ${r.status === "available" ? "border-status-complete/50 bg-white" : "border-stone-300 bg-stone-100"}`}>
                    <span className="text-lg font-semibold">Room {r.roomNumber}</span>
                    <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${r.status === "available" ? "bg-status-complete text-white" : "bg-stone-500 text-white"}`}>
                      <span aria-hidden="true">{r.status === "available" ? "✓" : "×"}</span>
                      {r.status === "available" ? "Available" : "Full"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl bg-white p-5">
          <p className="text-stone-700">Availability is set by the hostel Warden and can change during the day. Fees are shared on enquiry.</p>
          <Link href="/enquiry" className="mt-3 inline-flex h-12 items-center rounded-lg bg-ink px-5 font-semibold text-white">Contact for Pricing</Link>
        </div>
      </section>
    </>
  );
}
