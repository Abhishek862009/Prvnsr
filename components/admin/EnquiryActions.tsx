"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { en } from "@/messages/en";

type Status = "new" | "contacted" | "closed";
const t = en.admin.enquiries;

export default function EnquiryActions({ id, status }: { id: string; status: Status }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(method: "PATCH" | "DELETE", body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/enquiries/${id}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      if (!res.ok) setError(en.http.serverError);
      router.refresh();
    } catch {
      setError(en.http.serverError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Status">
        {(["new", "contacted", "closed"] as const).map((s) => (
          <button key={s} type="button" disabled={busy} aria-pressed={status === s} onClick={() => status !== s && call("PATCH", { status: s })} className={`h-10 rounded-lg border px-3 text-sm font-medium disabled:opacity-60 ${status === s ? "border-ink bg-ink text-white" : "border-stone-300 bg-white text-stone-800"}`}>
            {t[s]}
          </button>
        ))}
        <button type="button" disabled={busy} onClick={() => window.confirm(t.confirmDelete) && call("DELETE")} className="h-10 rounded-lg border border-red-300 px-3 text-sm font-medium text-red-700 disabled:opacity-60">{t.delete}</button>
      </div>
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
