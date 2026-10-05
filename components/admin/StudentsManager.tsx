"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { en } from "@/messages/en";

const t = en.admin.students;

export type StudentRow = {
  id: string;
  studentCode: string | null;
  name: string;
  roomId: string;
  roomNumber: string;
  parentName: string | null;
  parentEmail: string | null;
  parentWhatsapp: string | null;
  secondaryName: string | null;
  secondaryEmail: string | null;
  secondaryWhatsapp: string | null;
  studentPhone: string | null;
  isActive: boolean;
};
export type RoomOption = { id: string; roomNumber: string; capacity: number; activeStudents: number; isActive: boolean };

type Values = {
  name: string; studentCode: string; roomId: string; parentName: string; parentWhatsapp: string; parentEmail: string;
  secondaryName: string; secondaryWhatsapp: string; secondaryEmail: string; studentPhone: string;
};
type Outcome = { ok: true } | { ok: false; message: string; fields: Record<string, string> };

const field = "mt-1 h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-base outline-none focus:border-ink focus:ring-2 focus:ring-ink/20";
const btn = "h-11 rounded-lg border px-4 text-sm font-semibold disabled:opacity-50";

const toValues = (s?: StudentRow): Values => ({
  name: s?.name ?? "", studentCode: s?.studentCode ?? "", roomId: s?.roomId ?? "", parentName: s?.parentName ?? "",
  parentWhatsapp: s?.parentWhatsapp ?? "", parentEmail: s?.parentEmail ?? "", secondaryName: s?.secondaryName ?? "",
  secondaryWhatsapp: s?.secondaryWhatsapp ?? "", secondaryEmail: s?.secondaryEmail ?? "", studentPhone: s?.studentPhone ?? "",
});

export default function StudentsManager({ students, rooms }: { students: StudentRow[]; rooms: RoomOption[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(method: string, url: string, body: unknown): Promise<Outcome> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.status === 401) {
        router.push("/admin/login");
        return { ok: false, message: "", fields: {} };
      }
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: { message?: string; details?: { errors?: { field: string; message: string }[] } } } | null;
        const fields = Object.fromEntries((j?.error?.details?.errors ?? []).map((e) => [e.field, e.message]));
        const message = j?.error?.message ?? en.http.serverError;
        setError(message);
        return { ok: false, message, fields };
      }
      router.refresh();
      return { ok: true };
    } catch {
      setError(en.http.serverError);
      return { ok: false, message: en.http.serverError, fields: {} };
    } finally {
      setBusy(false);
    }
  }

  const clean = (v: Values) => ({
    name: v.name, studentCode: v.studentCode, parentName: v.parentName, parentWhatsapp: v.parentWhatsapp, parentEmail: v.parentEmail,
    secondaryName: v.secondaryName, secondaryWhatsapp: v.secondaryWhatsapp, secondaryEmail: v.secondaryEmail, studentPhone: v.studentPhone,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => { setAdding((v) => !v); setError(null); }} className={`${btn} border-ink bg-ink text-white`}>{adding ? t.cancel : t.add}</button>
        <Link href="/admin/students/import" className={`${btn} flex items-center border-ink text-ink`}>{t.importCsv}</Link>
      </div>

      {adding && (
        <section className="rounded-xl border border-ink/30 bg-white p-4">
          <h2 className="mb-2 font-display text-xl text-ink">{t.addTitle}</h2>
          <StudentForm mode="create" initial={toValues()} rooms={rooms} busy={busy} submitLabel={t.create}
            onSubmit={async (v) => { const r = await send("POST", "/api/admin/students", { ...clean(v), roomId: v.roomId }); if (r.ok) setAdding(false); return r; }} onCancel={() => setAdding(false)} />
        </section>
      )}

      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {students.length === 0 && <p className="rounded-xl bg-white p-4">{t.empty}</p>}

      <ul className="space-y-3">
        {students.map((s) => (
          <li key={s.id} className={`rounded-xl border bg-white p-4 ${s.isActive ? "border-stone-300" : "border-dashed border-stone-300"}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">{s.name} {!s.isActive && <span className="ml-1 rounded-full bg-stone-200 px-2 py-0.5 text-xs font-medium">{t.inactiveBadge}</span>}</h2>
                <p className="text-sm text-stone-600">Room {s.roomNumber}{s.studentCode ? ` · ${s.studentCode}` : ""} · {t.id} {s.id.slice(0, 8)}</p>
                <p className="text-sm text-stone-600">{s.parentName ? `${s.parentName} · ` : ""}{s.parentWhatsapp ?? "-"}{s.parentEmail ? ` · ${s.parentEmail}` : ""}</p>
              </div>
              {s.isActive && <Link href={`/admin/rooms/${s.roomNumber}/check`} className="text-sm font-medium text-ink underline">{t.openRoom}</Link>}
            </div>

            {editing === s.id ? (
              <div className="mt-3">
                <StudentForm mode="edit" initial={toValues(s)} rooms={rooms} busy={busy} submitLabel={t.save}
                  onSubmit={async (v) => { const r = await send("PATCH", `/api/admin/students/${s.id}`, clean(v)); if (r.ok) setEditing(null); return r; }} onCancel={() => setEditing(null)} />
                <p className="mt-2 text-xs text-stone-600">{t.idNote}</p>
              </div>
            ) : moving === s.id ? (
              <MoveForm student={s} rooms={rooms} busy={busy} onCancel={() => setMoving(null)}
                onMove={async (roomId) => { if (window.confirm(t.confirmMove)) { const r = await send("POST", `/api/admin/students/${s.id}/move`, { roomId }); if (r.ok) setMoving(null); } }} />
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => { setEditing(s.id); setError(null); }} className={`${btn} border-stone-300`}>{t.edit}</button>
                <button onClick={() => { setMoving(s.id); setError(null); }} className={`${btn} border-stone-300`}>{t.move}</button>
                {s.isActive ? (
                  <button disabled={busy} onClick={() => window.confirm(t.confirmDeactivate) && send("POST", `/api/admin/students/${s.id}/active`, { isActive: false })} className={`${btn} border-red-300 text-red-700`}>{t.deactivate}</button>
                ) : (
                  <button disabled={busy} onClick={() => window.confirm(t.confirmReactivate) && send("POST", `/api/admin/students/${s.id}/active`, { isActive: true })} className={`${btn} border-ink text-ink`}>{t.reactivate}</button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StudentForm({ mode, initial, rooms, busy, submitLabel, onSubmit, onCancel }: {
  mode: "create" | "edit"; initial: Values; rooms: RoomOption[]; busy: boolean; submitLabel: string;
  onSubmit: (v: Values) => Promise<Outcome>; onCancel: () => void;
}) {
  const [v, setV] = useState<Values>(initial);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const set = (k: keyof Values) => (e: { target: { value: string } }) => setV((p) => ({ ...p, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const r = await onSubmit(v);
    setErrs(r.ok ? {} : r.fields);
  }
  const err = (k: string) => errs[k] && <span role="alert" className="mt-1 block text-xs text-red-700">{errs[k]}</span>;
  const lab = "block text-sm font-medium";

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={lab}>{t.name}<input className={field} value={v.name} onChange={set("name")} maxLength={100} required />{err("name")}</label>
        <label className={lab}>{t.code}<input className={field} value={v.studentCode} onChange={set("studentCode")} maxLength={32} />{err("studentCode")}</label>
        {mode === "create" && (
          <label className={lab}>{t.room}
            <select className={field} value={v.roomId} onChange={set("roomId")} required>
              <option value="" disabled>{t.chooseRoom}</option>
              {rooms.filter((r) => r.isActive).map((r) => {
                const full = r.activeStudents >= r.capacity;
                return <option key={r.id} value={r.id} disabled={full}>{r.roomNumber} ({r.activeStudents}/{r.capacity}){full ? ` - ${t.full}` : ""}</option>;
              })}
            </select>
          </label>
        )}
        <label className={lab}>{t.parentName}<input className={field} value={v.parentName} onChange={set("parentName")} />{err("parentName")}</label>
        <label className={lab}>{t.parentWhatsapp}<input className={field} type="tel" inputMode="tel" value={v.parentWhatsapp} onChange={set("parentWhatsapp")} required />{err("parentWhatsapp")}</label>
        <label className={lab}>{t.parentEmail}<input className={field} type="email" value={v.parentEmail} onChange={set("parentEmail")} />{err("parentEmail")}</label>
        <label className={lab}>{t.studentPhone}<input className={field} type="tel" inputMode="tel" value={v.studentPhone} onChange={set("studentPhone")} />{err("studentPhone")}</label>
      </div>
      <fieldset className="rounded-lg bg-stone-50 p-3">
        <legend className="px-1 text-sm font-medium">{t.secondary}</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className={lab}>{t.secondaryName}<input className={field} value={v.secondaryName} onChange={set("secondaryName")} />{err("secondaryName")}</label>
          <label className={lab}>{t.secondaryWhatsapp}<input className={field} type="tel" inputMode="tel" value={v.secondaryWhatsapp} onChange={set("secondaryWhatsapp")} />{err("secondaryWhatsapp")}</label>
          <label className={lab}>{t.secondaryEmail}<input className={field} type="email" value={v.secondaryEmail} onChange={set("secondaryEmail")} />{err("secondaryEmail")}</label>
        </div>
      </fieldset>
      <div className="flex gap-2">
        <button disabled={busy} className={`${btn} border-ink bg-ink text-white`}>{busy ? t.saving : submitLabel}</button>
        <button type="button" onClick={onCancel} className={`${btn} border-stone-300`}>{t.cancel}</button>
      </div>
    </form>
  );
}

function MoveForm({ student, rooms, busy, onMove, onCancel }: { student: StudentRow; rooms: RoomOption[]; busy: boolean; onMove: (roomId: string) => void; onCancel: () => void }) {
  const [roomId, setRoomId] = useState("");
  return (
    <div className="mt-3 flex flex-wrap items-end gap-2">
      <label className="block min-w-48 flex-1 text-sm font-medium">{t.move}
        <select className={field} value={roomId} onChange={(e) => setRoomId(e.target.value)}>
          <option value="" disabled>{t.chooseRoom}</option>
          {rooms.filter((r) => r.isActive && r.id !== student.roomId).map((r) => {
            const full = student.isActive && r.activeStudents >= r.capacity;
            return <option key={r.id} value={r.id} disabled={full}>{r.roomNumber} ({r.activeStudents}/{r.capacity}){full ? ` - ${t.full}` : ""}</option>;
          })}
        </select>
      </label>
      <button disabled={busy || !roomId} onClick={() => onMove(roomId)} className={`${btn} border-ink bg-ink text-white`}>{t.moveBtn}</button>
      <button type="button" onClick={onCancel} className={`${btn} border-stone-300`}>{t.cancel}</button>
    </div>
  );
}
