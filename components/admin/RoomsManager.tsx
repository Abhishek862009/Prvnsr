"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { en } from "@/messages/en";
import { MAX_ROOM_CAPACITY, validateCapacityInput, validateRoomNumberInput } from "@/server/lib/rooms";
import AvailabilityToggle from "./AvailabilityToggle";

const t = en.admin.rooms;

export type RoomRow = {
  id: string;
  roomNumber: string;
  floor: number;
  capacity: number;
  isActive: boolean;
  publicAvailability: "available" | "full";
  activeStudents: number;
};

const field = "h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-base outline-none focus:border-ink focus:ring-2 focus:ring-ink/20";
const btn = "h-11 rounded-lg border px-4 text-sm font-semibold disabled:opacity-50";

export default function RoomsManager({ rooms }: { rooms: RoomRow[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [floor, setFloor] = useState("all");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [avail, setAvail] = useState<"all" | "available" | "full">("all");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const floors = useMemo(() => [...new Set(rooms.map((r) => r.floor))].sort((a, b) => a - b), [rooms]);
  const shown = rooms.filter(
    (r) =>
      (!q.trim() || r.roomNumber.includes(q.trim())) &&
      (floor === "all" || r.floor === Number(floor)) &&
      (status === "all" || (status === "active") === r.isActive) &&
      (avail === "all" || r.publicAvailability === avail),
  );

  async function send(method: "POST" | "PATCH", url: string, body: unknown): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.status === 401) {
        router.push("/admin/login");
        return false;
      }
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        setError(j?.error?.message ?? en.http.serverError);
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError(en.http.serverError);
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setAdding((v) => !v)} className={`${btn} border-ink bg-ink text-white`}>{adding ? t.cancel : t.add}</button>
        <Link href="/admin/rooms/import" className={`${btn} flex items-center border-ink text-ink`}>{t.importCsv}</Link>
      </div>

      {adding && <AddRoom busy={busy} onSubmit={async (b) => { if (await send("POST", "/api/admin/rooms", b)) setAdding(false); }} />}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}

      <div className="grid gap-2 sm:grid-cols-4">
        <input className={field} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.search} inputMode="numeric" aria-label={t.search} />
        <select className={field} value={floor} onChange={(e) => setFloor(e.target.value)} aria-label={t.floor}>
          <option value="all">{t.allFloors}</option>
          {floors.map((f) => <option key={f} value={f}>{t.floor} {f}</option>)}
        </select>
        <select className={field} value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Status">
          <option value="all">{t.allStatus}</option>
          <option value="active">{t.activeOnly}</option>
          <option value="inactive">{t.inactiveOnly}</option>
        </select>
        <select className={field} value={avail} onChange={(e) => setAvail(e.target.value as typeof avail)} aria-label={t.public}>
          <option value="all">{t.allAvail}</option>
          <option value="available">{en.admin.availability.available}</option>
          <option value="full">{en.admin.availability.full}</option>
        </select>
      </div>

      <p className="text-sm text-stone-600">{shown.length} / {rooms.length}</p>
      {shown.length === 0 && <p className="rounded-xl bg-white p-4">{t.empty}</p>}

      <ul className="grid gap-3 sm:grid-cols-2">
        {shown.map((r) => (
          <li key={r.id} className={`rounded-xl border bg-white p-4 ${r.isActive ? "border-stone-300" : "border-dashed border-stone-300 opacity-80"}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">Room {r.roomNumber}</h2>
                <p className="text-sm text-stone-600">{t.floor} {r.floor} · {r.activeStudents}/{r.capacity} {t.students}</p>
              </div>
              {!r.isActive && <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs font-medium">{t.inactive}</span>}
            </div>

            {editing === r.id ? (
              <EditRoom room={r} busy={busy} onCancel={() => setEditing(null)} onSave={async (patch) => { if (await send("PATCH", `/api/admin/rooms/${r.id}`, patch)) setEditing(null); }} />
            ) : (
              <div className="mt-3 space-y-3">
                {r.isActive && (
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-stone-500">{t.public}</p>
                    <AvailabilityToggle roomId={r.id} current={r.publicAvailability} />
                  </div>
                )}
                <button onClick={() => { setError(null); setEditing(r.id); }} className={`${btn} border-stone-300`}>{t.edit}</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AddRoom({ busy, onSubmit }: { busy: boolean; onSubmit: (b: { roomNumber: string; capacity: number }) => void }) {
  const [num, setNum] = useState("");
  const [cap, setCap] = useState("2");
  const check = validateRoomNumberInput(num);
  const capCheck = validateCapacityInput(Number(cap));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (check.ok && capCheck.ok) onSubmit({ roomNumber: check.roomNumber, capacity: capCheck.capacity });
  };
  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-ink/30 bg-white p-4">
      <h2 className="font-display text-xl text-ink">{t.addTitle}</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm font-medium">{t.roomNumber}
          <input className={`${field} mt-1`} value={num} onChange={(e) => setNum(e.target.value)} inputMode="numeric" required />
          {num && !check.ok && <span className="mt-1 block text-xs font-normal text-red-700">{check.message}</span>}
        </label>
        <label className="block text-sm font-medium">{t.floorAuto}
          <input className={`${field} mt-1 bg-stone-50`} value={check.ok ? String(check.floor) : "-"} readOnly aria-readonly="true" />
        </label>
        <label className="block text-sm font-medium">{t.capacity}
          <input className={`${field} mt-1`} type="number" min={1} max={MAX_ROOM_CAPACITY} value={cap} onChange={(e) => setCap(e.target.value)} required />
          {!capCheck.ok && <span className="mt-1 block text-xs font-normal text-red-700">{capCheck.message}</span>}
        </label>
      </div>
      <button disabled={busy || !check.ok || !capCheck.ok} className={`${btn} border-ink bg-ink text-white`}>{t.create}</button>
    </form>
  );
}

function EditRoom({ room, busy, onCancel, onSave }: { room: RoomRow; busy: boolean; onCancel: () => void; onSave: (patch: { roomNumber?: string; capacity?: number; isActive?: boolean }) => void }) {
  const [num, setNum] = useState(room.roomNumber);
  const [cap, setCap] = useState(String(room.capacity));
  const [active, setActive] = useState(room.isActive);
  const check = validateRoomNumberInput(num);
  const capCheck = validateCapacityInput(Number(cap));

  function save(e: FormEvent) {
    e.preventDefault();
    if (!check.ok || !capCheck.ok) return;
    const patch: { roomNumber?: string; capacity?: number; isActive?: boolean } = {};
    if (check.roomNumber !== room.roomNumber) patch.roomNumber = check.roomNumber;
    if (capCheck.capacity !== room.capacity) patch.capacity = capCheck.capacity;
    if (active !== room.isActive) patch.isActive = active;
    if (Object.keys(patch).length === 0) return onCancel();
    // Change-sensitive edits need an explicit confirmation.
    if (patch.roomNumber && !window.confirm(t.confirmRename)) return;
    if (patch.isActive === false && !window.confirm(t.confirmDeactivate)) return;
    if (patch.capacity !== undefined && patch.capacity < room.capacity && !window.confirm(t.confirmCapacity)) return;
    onSave(patch);
  }

  return (
    <form onSubmit={save} className="mt-3 space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm font-medium">{t.roomNumber}
          <input className={`${field} mt-1`} value={num} onChange={(e) => setNum(e.target.value)} inputMode="numeric" required />
          {!check.ok && <span className="mt-1 block text-xs font-normal text-red-700">{check.message}</span>}
        </label>
        <label className="block text-sm font-medium">{t.floorAuto}
          <input className={`${field} mt-1 bg-stone-50`} value={check.ok ? String(check.floor) : "-"} readOnly aria-readonly="true" />
        </label>
        <label className="block text-sm font-medium">{t.capacity}
          <input className={`${field} mt-1`} type="number" min={1} max={MAX_ROOM_CAPACITY} value={cap} onChange={(e) => setCap(e.target.value)} required />
          {!capCheck.ok && <span className="mt-1 block text-xs font-normal text-red-700">{capCheck.message}</span>}
        </label>
      </div>
      <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5" checked={active} onChange={(e) => setActive(e.target.checked)} />{t.active}</label>
      <div className="flex gap-2">
        <button disabled={busy || !check.ok || !capCheck.ok} className={`${btn} border-ink bg-ink text-white`}>{busy ? t.saving : t.save}</button>
        <button type="button" onClick={onCancel} className={`${btn} border-stone-300`}>{t.cancel}</button>
      </div>
    </form>
  );
}
