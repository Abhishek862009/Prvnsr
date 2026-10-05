"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { en } from "@/messages/en";
import { normalizePhone } from "@/server/lib/phone";
import { studentsWithoutParent, suggestLinks, type LinkCandidate } from "@/server/lib/parent-link";

const t = en.admin.parents;

type Student = LinkCandidate;
type Parent = {
  id: string;
  mobileE164: string;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  students: Student[];
};
type Props = { parents: Parent[]; students: Student[]; linkedStudentIds: string[] };

const box = "rounded-2xl border border-stone-300 bg-white p-4";
const field = "h-12 w-full rounded-lg border border-stone-300 bg-white px-3 text-base outline-none focus:border-ink focus:ring-2 focus:ring-ink/20";
const btn = "h-11 rounded-lg border px-4 text-sm font-semibold disabled:opacity-50";

/** Easy-to-read temporary password (no look-alike characters). The Warden may edit it. */
function generate(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export default function ParentManager({ parents, students, linkedStudentIds }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [share, setShare] = useState<{ mobile: string; password: string } | null>(null);
  const [mobile, setMobile] = useState("");
  const [pw, setPw] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());

  async function call(method: string, url: string, body?: unknown): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
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

  const normalized = normalizePhone(mobile);
  const suggestions = normalized ? suggestLinks(normalized, students, new Set()) : [];
  const withoutParent = studentsWithoutParent(students, new Set(linkedStudentIds));

  async function create(e: FormEvent) {
    e.preventDefault();
    if (await call("POST", "/api/admin/parents", { mobile, temporaryPassword: pw, studentIds: [...picked] })) {
      setShare({ mobile: normalized ?? mobile, password: pw });
      setMobile("");
      setPw("");
      setPicked(new Set());
    }
  }

  return (
    <div className="space-y-5">
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}

      {share && (
        <div role="status" className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <p className="font-semibold text-amber-900">{t.shareTitle}</p>
          <p className="mt-1 text-lg">{share.mobile} <span className="font-mono font-semibold">{share.password}</span></p>
          <p className="text-sm text-amber-900">{t.shareNote}</p>
          <button onClick={() => setShare(null)} className={`${btn} mt-2 border-amber-700 text-amber-900`}>{t.dismiss}</button>
        </div>
      )}

      <section className={box} aria-labelledby="create">
        <h2 id="create" className="font-display text-2xl text-ink">{t.createTitle}</h2>
        <form onSubmit={create} className="mt-3 space-y-3">
          <label className="block text-sm font-medium">{t.mobile}
            <input className={`${field} mt-1`} type="tel" inputMode="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} required />
          </label>
          <label className="block text-sm font-medium">{t.tempPassword}
            <div className="mt-1 flex gap-2">
              <input className={field} value={pw} onChange={(e) => setPw(e.target.value)} minLength={8} maxLength={128} required autoComplete="off" />
              <button type="button" onClick={() => setPw(generate())} className={`${btn} shrink-0 border-ink text-ink`}>{t.generate}</button>
            </div>
          </label>
          {normalized && (
            <fieldset className="rounded-lg bg-stone-50 p-3">
              <legend className="px-1 text-sm font-medium">{t.suggested}</legend>
              {suggestions.length === 0 && <p className="text-sm text-stone-600">{t.noSuggestions}</p>}
              {suggestions.map((s) => (
                <label key={s.studentId} className="flex min-h-11 items-center gap-3 text-sm">
                  <input type="checkbox" className="h-5 w-5" checked={picked.has(s.studentId)} onChange={(e) => setPicked((p) => { const n = new Set(p); if (e.target.checked) n.add(s.studentId); else n.delete(s.studentId); return n; })} />
                  {s.name} <span className="text-stone-500">· Room {s.roomNumber}{!s.isActive && ` · ${t.inactive}`}</span>
                </label>
              ))}
            </fieldset>
          )}
          <button disabled={busy} className="h-12 w-full rounded-lg bg-ink text-base font-semibold text-white disabled:opacity-60">{t.create}</button>
        </form>
      </section>

      <section className={box} aria-labelledby="without">
        <h2 id="without" className="font-display text-2xl text-ink">{t.withoutTitle}</h2>
        {withoutParent.length === 0 ? (
          <p className="mt-2 text-stone-700">{t.withoutEmpty}</p>
        ) : (
          <ul className="mt-2 divide-y divide-stone-200">
            {withoutParent.map((s) => (
              <li key={s.studentId} className="flex min-h-14 flex-wrap items-center justify-between gap-2 py-2">
                <span>{s.name} <span className="text-stone-500">· Room {s.roomNumber}</span><br /><span className="text-xs text-stone-500">{s.parentWhatsapp ?? t.noNumber}</span></span>
                <button type="button" disabled={!s.parentWhatsapp} onClick={() => { setMobile(s.parentWhatsapp ?? ""); window.scrollTo({ top: 0, behavior: "smooth" }); }} className={`${btn} border-ink text-ink`}>{t.setUp}</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="space-y-3">
        {parents.map((p) => (
          <ParentCard key={p.id} parent={p} students={students} busy={busy} call={call} onTemp={(password) => setShare({ mobile: p.mobileE164, password })} />
        ))}
      </div>
    </div>
  );
}

function ParentCard({ parent: p, students, busy, call, onTemp }: { parent: Parent; students: Student[]; busy: boolean; call: (m: string, u: string, b?: unknown) => Promise<boolean>; onTemp: (pw: string) => void }) {
  const [newPw, setNewPw] = useState("");
  const [newMobile, setNewMobile] = useState(p.mobileE164);
  const [pick, setPick] = useState("");
  const linked = new Set(p.students.map((s) => s.studentId));
  const suggested = suggestLinks(p.mobileE164, students, linked);
  const others = students.filter((s) => !linked.has(s.studentId));
  const base = `/api/admin/parents/${p.id}`;

  return (
    <section className={box} aria-label={p.mobileE164}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{p.mobileE164}</h2>
        <div className="flex flex-wrap gap-2 text-xs">
          {p.mustChangePassword && <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-900">{t.mustChange}</span>}
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-stone-700">{t.lastLogin}: {p.lastLoginAt ? new Date(p.lastLoginAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }) : t.never}</span>
        </div>
      </div>

      <div className="mt-3">
        <p className="text-sm font-semibold text-stone-700">{t.linked}</p>
        {p.students.length === 0 ? <p className="text-sm text-stone-600">{t.none}</p> : (
          <ul className="mt-1 space-y-1">
            {p.students.map((s) => (
              <li key={s.studentId} className="flex min-h-11 items-center justify-between gap-2 text-sm">
                <span>{s.name} <span className="text-stone-500">· Room {s.roomNumber}{!s.isActive && ` · ${t.inactive}`}</span></span>
                <button disabled={busy} onClick={() => window.confirm(t.confirmUnlink) && call("DELETE", `${base}/links/${s.studentId}`)} className={`${btn} border-stone-300 text-stone-800`}>{t.unlink}</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {suggested.length > 0 && (
        <div className="mt-3 rounded-lg bg-stone-50 p-3">
          <p className="text-sm font-semibold">{t.linkSuggested}</p>
          {suggested.map((s) => (
            <div key={s.studentId} className="flex min-h-11 items-center justify-between gap-2 text-sm">
              <span>{s.name} <span className="text-stone-500">· Room {s.roomNumber}</span></span>
              <button disabled={busy} onClick={() => call("POST", `${base}/links`, { studentId: s.studentId })} className={`${btn} border-ink text-ink`}>{t.link}</button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <select value={pick} onChange={(e) => setPick(e.target.value)} className={field} aria-label={t.linkAnother}>
          <option value="">{t.linkAnother}: {t.choose}</option>
          {others.map((s) => <option key={s.studentId} value={s.studentId}>{s.name} · Room {s.roomNumber}</option>)}
        </select>
        <button disabled={busy || !pick} onClick={async () => { if (await call("POST", `${base}/links`, { studentId: pick })) setPick(""); }} className={`${btn} shrink-0 border-ink text-ink`}>{t.link}</button>
      </div>

      <div className="mt-3 flex gap-2">
        <input className={field} value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder={t.tempPassword} minLength={8} autoComplete="off" aria-label={t.tempPassword} />
        <button type="button" onClick={() => setNewPw(generate())} className={`${btn} shrink-0 border-stone-300`}>{t.generate}</button>
        <button disabled={busy || newPw.length < 8} onClick={async () => { if (await call("POST", `${base}/password`, { temporaryPassword: newPw })) { onTemp(newPw); setNewPw(""); } }} className={`${btn} shrink-0 border-ink bg-ink text-white`}>{t.reset}</button>
      </div>

      <div className="mt-3 flex gap-2">
        <input className={field} type="tel" inputMode="tel" value={newMobile} onChange={(e) => setNewMobile(e.target.value)} aria-label={t.mobile} />
        <button disabled={busy || !newMobile.trim() || normalizePhone(newMobile) === p.mobileE164} onClick={() => call("PATCH", base, { mobile: newMobile })} className={`${btn} shrink-0 border-stone-300`}>{t.saveNumber}</button>
      </div>

      {p.students.length === 0 && (
        <button disabled={busy} onClick={() => window.confirm(t.confirmDelete) && call("DELETE", base)} className={`${btn} mt-3 border-red-300 text-red-700`}>{t.deleteAccount}</button>
      )}
    </section>
  );
}
