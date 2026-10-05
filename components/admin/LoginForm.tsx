"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { en } from "@/messages/en";

export default function LoginForm({ notice }: { notice?: string }) {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const t = en.admin.login;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId, password }),
      });
      if (res.ok) {
        router.push("/admin/dashboard");
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

  const field = "h-12 w-full rounded-lg border border-stone-300 bg-white px-3 text-base outline-none focus:border-ink focus:ring-2 focus:ring-ink/20";
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {notice && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{notice}</p>}
      <label className="block text-sm font-medium">
        {t.loginId}
        <input className={`${field} mt-1`} value={loginId} onChange={(e) => setLoginId(e.target.value)} autoComplete="username" required />
      </label>
      <label className="block text-sm font-medium">
        {t.password}
        <input className={`${field} mt-1`} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
      </label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button disabled={busy} className="h-12 w-full rounded-lg bg-ink text-base font-semibold text-white disabled:opacity-60">
        {busy ? t.signingIn : t.submit}
      </button>
    </form>
  );
}
