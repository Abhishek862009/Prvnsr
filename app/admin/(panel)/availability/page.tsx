import AvailabilityToggle from "@/components/admin/AvailabilityToggle";
import { requireWarden } from "@/server/auth/guards";
import { listRooms } from "@/server/services/rooms";
import { en } from "@/messages/en";

export const dynamic = "force-dynamic";

const t = en.admin.availability;

export default async function AvailabilityAdminPage() {
  await requireWarden();
  const rooms = (await listRooms()).filter((r) => r.isActive);
  const floors = [...new Set(rooms.map((r) => r.floor))].sort((a, b) => a - b);

  return (
    <main className="space-y-5">
      <header>
        <h1 className="font-display text-3xl text-ink">{t.title}</h1>
        <p className="mt-1 max-w-2xl text-stone-700">{t.intro}</p>
      </header>
      {rooms.length === 0 && <p className="rounded-xl bg-white p-4">{t.noRooms}</p>}
      {floors.map((f) => (
        <section key={f}>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-600">{t.floor} {f}</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.filter((r) => r.floor === f).map((r) => (
              <li key={r.id} className="rounded-xl border border-stone-300 bg-white p-4">
                <div className="mb-3 flex items-baseline justify-between">
                  <span className="text-lg font-semibold">Room {r.roomNumber}</span>
                  {/* Warden-only hint. Never shown publicly and never used to decide the status. */}
                  <span className="text-xs text-stone-500">{r.activeStudents}/{r.capacity} {t.students}</span>
                </div>
                <AvailabilityToggle roomId={r.id} current={r.publicAvailability} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
