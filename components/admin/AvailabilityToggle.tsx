"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { en } from "@/messages/en";

const t = en.admin.availability;

export default function AvailabilityToggle({ roomId, current }: { roomId: string; current: "available" | "full" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function set(next: "available" | "full") {
    if (next === current) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/rooms/${roomId}/availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availability: next }),
      });
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        setError(json?.error?.message ?? en.http.serverError);
      }
      router.refresh();
    } catch {
      setError(en.http.serverError);
    } finally {
      setBusy(false);
    }
  }

  const btn = (on: boolean, tone: string) => `h-11 flex-1 rounded-lg border px-3 text-sm font-semibold disabled:opacity-60 ${on ? tone : "border-stone-300 bg-white text-stone-700"}`;
  return (
    <div>
      <div className="flex gap-2" role="group" aria-label="Public availability">
        <button type="button" disabled={busy} aria-pressed={current === "available"} onClick={() => set("available")} className={btn(current === "available", "border-status-complete bg-status-complete text-white")}>{t.available}</button>
        <button type="button" disabled={busy} aria-pressed={current === "full"} onClick={() => set("full")} className={btn(current === "full", "border-stone-600 bg-stone-600 text-white")}>{t.full}</button>
      </div>
      {error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
