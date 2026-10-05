"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { en } from "@/messages/en";

const t = en.admin.recover;

/** The recovery key is typed here and sent once over HTTPS; it is never stored, logged or shown again. */
export default function RecoverForm() {
  const [key, setKey] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (pw !== pw2) return setError(t.mismatch);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recoveryKey: key, newPassword: pw }),
      });
      if (res.ok) {
        setDone(true);
        return;
      }
      const j = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(j?.error?.message ?? en.http.serverError);
    } catch {
      setError(en.http.serverError);
    } finally {
      // Never keep the secrets in the page longer than needed.
      setKey("");
      setPw("");
      setPw2("");
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div role="status" className="space-y-4">
        <p className="rounded-lg bg-green-50 p-3 text-sm text-green-900">{t.done}</p>
        <Link href="/admin/login" className="flex h-12 items-center justify-center rounded-lg bg-ink text-base font-semibold text-white">{t.toLogin}</Link>
      </div>
    );
  }

  const field = "mt-1 h-12 w-full rounded-lg border border-stone-300 bg-white px-3 text-base outline-none focus:border-ink focus:ring-2 focus:ring-ink/20";
  return (
    <form onSubmit={onSubmit} className="space-y-4" autoComplete="off">
      <p className="text-sm text-stone-700">{t.intro}</p>
      <label className="block text-sm font-medium">{t.key}
        <input className={field} type="password" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" required />
      </label>
      <label className="block text-sm font-medium">{t.newPassword}
        <input className={field} type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" minLength={8} maxLength={128} required />
        <span className="mt-1 block text-xs font-normal text-stone-600">{t.hint}</span>
      </label>
      <label className="block text-sm font-medium">{t.confirm}
        <input className={field} type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" minLength={8} maxLength={128} required />
      </label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button disabled={busy} className="h-12 w-full rounded-lg bg-ink text-base font-semibold text-white disabled:opacity-60">{busy ? t.saving : t.submit}</button>
      <p className="text-center text-sm"><Link href="/admin/login" className="text-ink underline">{t.back}</Link></p>
    </form>
  );
}
