import Link from "next/link";
import { notFound } from "next/navigation";
import RoomCheckForm from "@/components/admin/RoomCheckForm";
import { requireWarden } from "@/server/auth/guards";
import { formatDateLong } from "@/server/lib/dates";
import { DomainError } from "@/server/lib/errors";
import { findRoomByNumberOrFail, getRoomCheck } from "@/server/services/checking";
import { en } from "@/messages/en";

export const dynamic = "force-dynamic";

export default async function RoomCheckPage({ params }: { params: Promise<{ roomNumber: string }> }) {
  await requireWarden();
  const { roomNumber } = await params;
  if (!/^\d{3,4}$/.test(roomNumber)) notFound();

  let data;
  try {
    const room = await findRoomByNumberOrFail(roomNumber);
    data = await getRoomCheck(room.id);
  } catch (err) {
    if (err instanceof DomainError && err.kind === "not_found") notFound();
    throw err;
  }

  return (
    <main className="space-y-4 pb-28">
      <header>
        <Link href={`/admin/floors/${data.room.floor}`} className="text-sm text-ink underline">{en.admin.check.backToMap}</Link>
        <p className="mt-2 text-sm text-stone-600">{formatDateLong(data.date)}</p>
        <h1 className="font-display text-3xl text-ink">Room {data.room.roomNumber}</h1>
      </header>
      <RoomCheckForm
        roomId={data.room.id}
        status={data.status}
        isVacant={data.isVacant}
        isManuallyComplete={data.isManuallyComplete}
        initialCommonNote={data.commonNote}
        students={data.students.map((s) => ({
          id: s.id,
          name: s.name,
          check: s.check
            ? {
                ...s.check,
                lastEditedAt: s.check.lastEditedAt ? s.check.lastEditedAt.toISOString() : null,
                ack: { state: s.check.ack.state, at: s.check.ack.at ? s.check.ack.at.toISOString() : null },
              }
            : null,
        }))}
      />
    </main>
  );
}
