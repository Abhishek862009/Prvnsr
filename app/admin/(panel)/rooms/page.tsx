import RoomsManager from "@/components/admin/RoomsManager";
import { requireWarden } from "@/server/auth/guards";
import { listRooms } from "@/server/services/rooms";
import { en } from "@/messages/en";

export const dynamic = "force-dynamic";

export default async function RoomsPage() {
  await requireWarden();
  const rooms = await listRooms();
  return (
    <main className="space-y-4">
      <header>
        <h1 className="font-display text-3xl text-ink">{en.admin.rooms.title}</h1>
        <p className="mt-1 max-w-2xl text-stone-700">{en.admin.rooms.intro}</p>
      </header>
      <RoomsManager rooms={rooms} />
    </main>
  );
}
