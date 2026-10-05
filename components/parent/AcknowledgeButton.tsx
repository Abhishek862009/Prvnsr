"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { en } from "@/messages/en";

/** Sends the revision the parent is looking at, so a report edited meanwhile cannot be "seen" blindly. */
export default function AcknowledgeButton({ checkId, revision }: { checkId: string; revision: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = en.parent.ack;

  async function onClick() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/parent/reports/${checkId}/acknowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision }),
      });
      if (res.status === 401) {
        router.push("/parent/login");
        return;
      }
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        setError(json?.error?.message ?? en.http.serverError);
      }
      router.refresh(); // shows the latest version (or the Seen state)
    } catch {
      setError(en.http.serverError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button onClick={onClick} disabled={busy} className="h-12 rounded-lg bg-ink px-5 text-base font-semibold text-white disabled:opacity-60">
        {busy ? t.working : t.button}
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
