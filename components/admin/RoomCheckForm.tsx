"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { en } from "@/messages/en";

type Status = "present" | "absent" | "other";
type Entry = { status: Status | null; stars: number | null; note: string };

export type CheckStudent = {
  id: string;
  name: string;
  check: {
    status: Status;
    stars: number | null;
    note: string;
    revision: number;
    lastEditedAt: string | null;
    ack: { state: "none" | "acknowledged" | "updated"; at: string | null };
  } | null;
};

type Props = {
  roomId: string;
  status: "pending" | "complete" | "vacant";
  isVacant: boolean;
  isManuallyComplete: boolean;
  initialCommonNote: string;
  students: CheckStudent[];
};

type ApiResult = { nextRoomNumber?: string | null; error?: { code?: string; message?: string; details?: { code?: string } } };

const t = en.admin.check;
const ackTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

const STATUS_STYLE: Record<Status, string> = {
  present: "bg-status-complete text-white border-status-complete",
  absent: "bg-status-pending text-white border-status-pending",
  other: "bg-amber-700 text-white border-amber-700",
};

export default function RoomCheckForm({ roomId, status, isVacant, isManuallyComplete, initialCommonNote, students }: Props) {
  const router = useRouter();
  const [entries, setEntries] = useState<Record<string, Entry>>(() =>
    Object.fromEntries(students.map((s) => [s.id, s.check ? { status: s.check.status, stars: s.check.stars, note: s.check.note } : { status: null, stars: null, note: "" }])),
  );
  const [commonNote, setCommonNote] = useState(initialCommonNote);
  // An already-checked room is read-only until the Warden confirms "Edit today's record?".
  const [locked, setLocked] = useState(status === "complete");
  const [confirmedEdit, setConfirmedEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const get = (id: string): Entry => entries[id] ?? { status: null, stars: null, note: "" };
  const patch = (id: string, change: Partial<Entry>) => setEntries((prev) => ({ ...prev, [id]: { ...(prev[id] ?? { status: null, stars: null, note: "" }), ...change } }));

  const complete =
    students.length > 0 &&
    students.every((s) => {
      const e = get(s.id);
      if (!e.status) return false;
      if (e.status === "present") return e.stars !== null;
      if (e.status === "other") return e.note.trim() !== "";
      return true;
    });

  async function call(url: string, method: "PUT" | "POST", body: unknown, navigate: boolean): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = (await res.json().catch(() => ({}))) as ApiResult;
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      if (!res.ok) {
        // Server-side guard for editing a finished room: ask, then retry once.
        if (json.error?.details?.code === "edit_confirmation_required" && window.confirm(t.editConfirm)) {
          setConfirmedEdit(true);
          setBusy(false);
          return call(url, method, { ...(body as object), confirmEdit: true }, navigate);
        }
        setError(json.error?.message ?? en.http.serverError);
        return;
      }
      if (navigate) router.push(json.nextRoomNumber ? `/admin/rooms/${json.nextRoomNumber}/check` : "/admin/dashboard");
      router.refresh();
    } catch {
      setError(en.http.serverError);
    } finally {
      setBusy(false);
    }
  }

  const save = () =>
    call(
      `/api/admin/rooms/${roomId}/check`,
      "PUT",
      {
        entries: students.map((s) => {
          const e = get(s.id);
          return { studentId: s.id, status: e.status, stars: e.status === "present" ? e.stars : null, note: e.note };
        }),
        commonNote,
        confirmEdit: confirmedEdit,
      },
      true,
    );

  function unlock() {
    if (window.confirm(t.editConfirm)) {
      setLocked(false);
      setConfirmedEdit(true);
    }
  }

  const markVacant = () => {
    if (window.confirm(t.confirmVacant)) void call(`/api/admin/rooms/${roomId}/vacant`, "POST", { isVacant: true }, true);
  };

  const disabled = busy || locked || isVacant;
  const box = "rounded-xl border border-stone-300 bg-white p-4";
  const btn = "flex h-12 items-center justify-center rounded-lg border px-4 text-base font-medium disabled:opacity-50";

  return (
    <div className="space-y-4">
      {isVacant && (
        <div className={`${box} flex flex-wrap items-center justify-between gap-3 border-status-vacant`}>
          <p>{t.vacantNotice}</p>
          <button disabled={busy} onClick={() => call(`/api/admin/rooms/${roomId}/vacant`, "POST", { isVacant: false }, false)} className={`${btn} border-ink text-ink`}>{t.removeVacant}</button>
        </div>
      )}
      {locked && !isVacant && (
        <div className={`${box} flex flex-wrap items-center justify-between gap-3 border-status-complete`}>
          <p>{t.completeNotice}</p>
          <button disabled={busy} onClick={unlock} className={`${btn} border-ink text-ink`}>{t.editRecord}</button>
        </div>
      )}

      {students.length === 0 && <p className={box}>{t.noStudents}</p>}

      {students.map((s) => {
        const e = get(s.id);
        const edited = !!s.check?.lastEditedAt;
        return (
          <section key={s.id} className={box} aria-label={s.name}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">{s.name}</h2>
              {edited && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">{t.edited}</span>}
            </div>

            {s.check && (
              <p className="mt-1 text-sm text-stone-600">
                {s.check.ack.state === "acknowledged" && s.check.ack.at && <span className="text-status-complete">{t.parentSeen} {ackTime(s.check.ack.at)}</span>}
                {s.check.ack.state === "updated" && <span className="text-amber-800">{t.parentSeenOlder}</span>}
                {s.check.ack.state === "none" && <span>{t.parentNotSeen}</span>}
              </p>
            )}

            <div role="group" aria-label="Status" className="mt-3 grid grid-cols-3 gap-2">
              {(["present", "absent", "other"] as const).map((v) => (
                <button key={v} type="button" disabled={disabled} aria-pressed={e.status === v} onClick={() => patch(s.id, { status: v, stars: v === "present" ? e.stars : null })} className={`${btn} ${e.status === v ? STATUS_STYLE[v] : "border-stone-300 bg-white text-stone-800"}`}>
                  {t[v]}
                </button>
              ))}
            </div>

            {e.status === "present" && (
              <div role="group" aria-label={t.stars} className="mt-3 flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" disabled={disabled} aria-label={`${n} ${t.stars}`} aria-pressed={e.stars === n} onClick={() => patch(s.id, { stars: n })} className={`h-12 w-12 text-3xl leading-none disabled:opacity-50 ${e.stars !== null && n <= e.stars ? "text-amber-500" : "text-stone-300"}`}>
                    ★
                  </button>
                ))}
              </div>
            )}

            {e.status && (
              <label className="mt-3 block text-sm font-medium">
                {e.status === "other" ? t.noteRequired : t.noteOptional}
                <textarea disabled={disabled} value={e.note} maxLength={1000} rows={2} onChange={(ev) => patch(s.id, { note: ev.target.value })} className="mt-1 w-full rounded-lg border border-stone-300 p-2 text-base disabled:bg-stone-50" />
              </label>
            )}
          </section>
        );
      })}

      {students.length > 0 && (
        <label className={`${box} block text-sm font-medium`}>
          {t.roomNote}
          <textarea disabled={disabled} value={commonNote} maxLength={1000} rows={2} onChange={(ev) => setCommonNote(ev.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 p-2 text-base font-normal disabled:bg-stone-50" />
          <span className="mt-1 block text-xs font-normal text-stone-600">{t.roomNoteHint}</span>
          <span className="block text-xs font-normal text-amber-800">{t.roomNoteWarning}</span>
        </label>
      )}

      <div className="flex flex-wrap gap-3">
        {!isVacant && (
          <button type="button" disabled={busy} onClick={markVacant} className={`${btn} border-stone-400 bg-white`}>{t.markVacant}</button>
        )}
        {!isVacant && !isManuallyComplete && status !== "complete" && (
          <button type="button" disabled={busy} onClick={() => call(`/api/admin/rooms/${roomId}/complete`, "POST", { isComplete: true }, true)} className={`${btn} border-stone-400 bg-white`}>{t.markComplete}</button>
        )}
        {isManuallyComplete && (
          <button type="button" disabled={busy} onClick={() => call(`/api/admin/rooms/${roomId}/complete`, "POST", { isComplete: false }, false)} className={`${btn} border-stone-400 bg-white`}>{t.undoComplete}</button>
        )}
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}

      {/* Primary action, pinned to the bottom for one-handed phone use. */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-stone-300 bg-paper/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto max-w-5xl">
          {!complete && students.length > 0 && !disabled && <p className="mb-2 text-xs text-stone-600">{t.incomplete}</p>}
          <button type="button" onClick={save} disabled={disabled || !complete} className="h-14 w-full rounded-xl bg-ink text-lg font-semibold text-white disabled:opacity-40">
            {busy ? t.saving : t.saveNext}
          </button>
        </div>
      </div>
    </div>
  );
}
