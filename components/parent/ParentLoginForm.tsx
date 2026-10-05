"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { en } from "@/messages/en";

export default function ParentLoginForm() {
  const router = useRouter();
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const t = en.parent.login;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/parent/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, password }),
      });
      const json = (await res.json().catch(() => null)) as { mustChangePassword?: boolean; error?: { message?: string } } | null;
      if (res.ok) {
        // First login: the password must be changed before anything else is reachable.
        router.push(json?.mustChangePassword ? "/parent/password" : "/parent/dashboard");
        router.refresh();
        return;
      }
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
      <label className="block text-sm font-medium">
        {t.mobile}
        <input className={field} type="tel" inputMode="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} autoComplete="username" required />
      </label>
      <label className="block text-sm font-medium">
        {t.password}
        <input className={field} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
      </label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button disabled={busy} className="h-12 w-full rounded-lg bg-ink text-base font-semibold text-white disabled:opacity-60">{busy ? t.signingIn : t.submit}</button>
      <p className="text-xs text-stone-600">{t.hint}</p>
    </form>
  );
}
