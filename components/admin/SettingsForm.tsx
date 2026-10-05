"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { en } from "@/messages/en";

const t = en.admin.settings;

export default function SettingsForm({ initialCall, initialWhatsapp }: { initialCall: string; initialWhatsapp: string }) {
  const router = useRouter();
  const [call, setCall] = useState(initialCall);
  const [whatsapp, setWhatsapp] = useState(initialWhatsapp);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callNumber: call, whatsappNumber: whatsapp }),
      });
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      const json = (await res.json().catch(() => null)) as { settings?: { callNumber: string | null; whatsappNumber: string | null }; error?: { message?: string } } | null;
      if (!res.ok) {
        setError(json?.error?.message ?? en.http.serverError);
        return;
      }
      // Show the normalised numbers the website will actually use.
      setCall(json?.settings?.callNumber ?? "");
      setWhatsapp(json?.settings?.whatsappNumber ?? "");
      setSaved(true);
      router.refresh();
    } catch {
      setError(en.http.serverError);
    } finally {
      setBusy(false);
    }
  }

  const field = "mt-1 h-12 w-full rounded-lg border border-stone-300 bg-white px-3 text-base outline-none focus:border-ink focus:ring-2 focus:ring-ink/20";
  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-stone-300 bg-white p-4">
      <label className="block text-sm font-medium">{t.call}
        <input className={field} type="tel" inputMode="tel" value={call} onChange={(e) => setCall(e.target.value)} />
      </label>
      <label className="block text-sm font-medium">{t.whatsapp}
        <input className={field} type="tel" inputMode="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
      </label>
      <p className="text-xs text-stone-600">{t.hint}</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {saved && <p role="status" className="text-sm text-status-complete">{t.saved}</p>}
      <button disabled={busy} className="h-12 w-full rounded-lg bg-ink text-base font-semibold text-white disabled:opacity-60">{busy ? t.saving : t.save}</button>
    </form>
  );
}
