"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { en } from "@/messages/en";

export default function PasswordForm({ firstLogin }: { firstLogin: boolean }) {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const t = en.parent.password;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (next !== confirm) {
      setError(t.mismatch);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/parent/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      if (res.ok) {
        setDone(true);
        router.push("/parent/dashboard");
        router.refresh();
        return;
      }
      const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(json?.error?.message ?? en.http.serverError);
    } catch {
      setError(en.http.serverError);
    } finally {
      setBusy(false);
    }
  }

  const field = "mt-1 h-12 w-full rounded-lg border border-stone-300 bg-white px-3 text-base outline-none focus:border-ink focus:ring-2 focus:ring-ink/20";
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {firstLogin && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{t.firstLoginNotice}</p>}
      <label className="block text-sm font-medium">
        {t.current}
        <input className={field} type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
      </label>
      <label className="block text-sm font-medium">
        {t.new}
        <input className={field} type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={8} maxLength={128} required />
        <span className="mt-1 block text-xs font-normal text-stone-600">{t.hint}</span>
      </label>
      <label className="block text-sm font-medium">
        {t.confirm}
        <input className={field} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" minLength={8} maxLength={128} required />
      </label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {done && <p className="text-sm text-status-complete">{t.done}</p>}
      <button disabled={busy} className="h-12 w-full rounded-lg bg-ink text-base font-semibold text-white disabled:opacity-60">{busy ? t.saving : t.submit}</button>
    </form>
  );
}
