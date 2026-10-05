"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { en } from "@/messages/en";

const t = en.admin.import;

type RowError = { column: string; message: string };
type PlanRow = { rowNumber: number; action: string; label: string; errors: RowError[] };
type Plan = {
  fileErrors: string[];
  rows: PlanRow[];
  summary: { total: number; create: number; update: number; unchanged: number; errors: number };
  canCommit: boolean;
};

type Props = {
  kind: "students" | "rooms";
  previewUrl: string;
  commitUrl: string;
  sampleUrl: string;
  maxBytes: number;
  /** Rooms only: create / update mode, sent as ?mode= */
  modes?: boolean;
};

/** Normalises both server plan shapes (students / rooms) into one table model. */
function normalise(kind: Props["kind"], raw: Record<string, unknown>): Plan {
  const s = (raw.summary ?? {}) as Partial<Plan["summary"]>;
  const rows = ((raw.rows ?? []) as Record<string, unknown>[]).map((r) => ({
    rowNumber: Number(r.rowNumber),
    action: String(r.action),
    label: kind === "students" ? String((r.fields as { name?: string } | null)?.name ?? "-") : `Room ${String(r.roomNumber ?? "-")}`,
    errors: (r.errors ?? []) as RowError[],
  }));
  return {
    fileErrors: (raw.fileErrors ?? []) as string[],
    rows,
    summary: { total: s.total ?? 0, create: s.create ?? 0, update: s.update ?? 0, unchanged: s.unchanged ?? 0, errors: s.errors ?? 0 },
    canCommit: raw.canCommit === true,
  };
}

const btn = "h-12 rounded-lg px-5 text-base font-semibold disabled:opacity-50";
const BADGE: Record<string, string> = {
  create: "bg-green-100 text-green-900",
  update: "bg-blue-100 text-blue-900",
  unchanged: "bg-stone-200 text-stone-700",
  error: "bg-red-100 text-red-900",
};

export default function CsvImporter({ kind, previewUrl, commitUrl, sampleUrl, maxBytes, modes }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"create" | "update">("create");
  const [csv, setCsv] = useState<string | null>(null); // the exact text that was previewed
  const [fileName, setFileName] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState<"preview" | "commit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; updated: number } | null>(null);

  const url = (base: string) => (modes ? `${base}?mode=${mode}` : base);

  function reset() {
    setCsv(null);
    setPlan(null);
    setConfirmed(false);
    setResult(null);
    setError(null);
    setFileName("");
    if (fileRef.current) fileRef.current.value = "";
  }

  // Any change of file or mode invalidates the previous preview: nothing can be committed unseen.
  function invalidate() {
    setPlan(null);
    setCsv(null);
    setConfirmed(false);
    setResult(null);
    setError(null);
  }

  async function preview() {
    const file = fileRef.current?.files?.[0];
    setError(null);
    if (!file) return setError(t.choose);
    if (!/\.csv$/i.test(file.name) && !/csv|text\/plain|excel/.test(file.type)) return setError(t.notCsv);
    if (file.size > maxBytes) return setError(t.tooBig);
    setBusy("preview");
    try {
      const text = await file.text();
      const res = await fetch(url(previewUrl), { method: "POST", headers: { "Content-Type": "text/csv" }, body: text });
      if (res.status === 401) return router.push("/admin/login");
      const j = (await res.json().catch(() => null)) as { plan?: Record<string, unknown>; error?: { message?: string } } | null;
      if (!res.ok || !j?.plan) return setError(j?.error?.message ?? en.http.serverError);
      setCsv(text);
      setFileName(file.name);
      setPlan(normalise(kind, j.plan));
      setConfirmed(false);
      setOnlyErrors(false);
    } catch {
      setError(en.http.serverError);
    } finally {
      setBusy(null);
    }
  }

  async function commit() {
    if (!plan?.canCommit || csv === null || !confirmed) return;
    setBusy("commit");
    setError(null);
    try {
      const res = await fetch(url(commitUrl), { method: "POST", headers: { "Content-Type": "text/csv" }, body: csv });
      if (res.status === 401) return router.push("/admin/login");
      const j = (await res.json().catch(() => null)) as { created?: number; updated?: number; error?: { message?: string } } | null;
      if (!res.ok) {
        // Nothing was written. Show why and ask for a fresh preview.
        setError(j?.error?.message ?? en.http.serverError);
        setPlan(null);
        return;
      }
      setResult({ created: j?.created ?? 0, updated: j?.updated ?? 0 });
      setPlan(null);
      setCsv(null);
      router.refresh();
    } catch {
      setError(en.http.serverError);
    } finally {
      setBusy(null);
    }
  }

  const shown = plan ? (onlyErrors ? plan.rows.filter((r) => r.action === "error") : plan.rows) : [];
  const box = "space-y-3 rounded-2xl border border-stone-300 bg-white p-4";

  return (
    <div className="space-y-4">
      <section className={box}>
        <a href={sampleUrl} download className="inline-flex h-11 items-center rounded-lg border border-ink px-4 text-sm font-semibold text-ink">{t.sample}</a>

        {modes && (
          <fieldset className="space-y-1">
            <legend className="text-sm font-medium">{t.mode}</legend>
            {(["create", "update"] as const).map((m) => (
              <label key={m} className="flex min-h-11 items-center gap-3 text-sm">
                <input type="radio" name="mode" className="h-5 w-5" checked={mode === m} onChange={() => { setMode(m); invalidate(); }} />
                {m === "create" ? t.create : t.update}
              </label>
            ))}
          </fieldset>
        )}

        <label className="block text-sm font-medium">{t.choose}
          <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={invalidate} className="mt-1 block w-full text-sm" />
        </label>
        <button onClick={preview} disabled={busy !== null} className={`${btn} w-full border border-ink text-ink`}>{busy === "preview" ? t.previewing : t.preview}</button>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      </section>

      {result && (
        <section role="status" className="space-y-2 rounded-2xl border border-status-complete/40 bg-green-50 p-4 text-green-900">
          <p className="font-semibold">{t.done}</p>
          <p className="text-sm">{result.created} {t.created} · {result.updated} {t.updated}</p>
          <button onClick={reset} className="h-11 rounded-lg border border-green-800 px-4 text-sm font-semibold">{t.another}</button>
        </section>
      )}

      {plan && (
        <section className={box} aria-label={t.summary}>
          <h2 className="font-display text-xl text-ink">{t.summary} <span className="text-base font-normal text-stone-600">({fileName})</span></h2>

          {plan.fileErrors.length > 0 && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-900">
              <p className="font-semibold">{t.fileErrors}</p>
              <ul className="mt-1 list-disc pl-5">{plan.fileErrors.map((m) => <li key={m}>{m}</li>)}</ul>
            </div>
          )}

          <dl className="grid grid-cols-2 gap-2 text-center sm:grid-cols-5">
            <div className="rounded-lg bg-stone-50 p-2"><dd className="text-xl font-semibold">{plan.summary.total}</dd><dt className="text-xs text-stone-600">{t.rows}</dt></div>
            <div className="rounded-lg bg-green-50 p-2"><dd className="text-xl font-semibold text-green-800">{plan.summary.create}</dd><dt className="text-xs text-stone-600">{t.willCreate}</dt></div>
            <div className="rounded-lg bg-blue-50 p-2"><dd className="text-xl font-semibold text-blue-800">{plan.summary.update}</dd><dt className="text-xs text-stone-600">{t.willUpdate}</dt></div>
            <div className="rounded-lg bg-stone-50 p-2"><dd className="text-xl font-semibold text-stone-700">{plan.summary.unchanged}</dd><dt className="text-xs text-stone-600">{t.unchanged}</dt></div>
            <div className="rounded-lg bg-red-50 p-2"><dd className="text-xl font-semibold text-red-800">{plan.summary.errors}</dd><dt className="text-xs text-stone-600">{t.errors}</dt></div>
          </dl>

          {plan.rows.length > 0 && (
            <>
              {plan.summary.errors > 0 && (
                <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5" checked={onlyErrors} onChange={(e) => setOnlyErrors(e.target.checked)} />{t.onlyErrors}</label>
              )}
              <div className="max-h-[28rem] overflow-auto rounded-lg border border-stone-200">
                <table className="w-full min-w-[32rem] text-left text-sm">
                  <thead className="sticky top-0 bg-stone-100 text-xs uppercase tracking-wide text-stone-600">
                    <tr><th className="p-2">{t.row}</th><th className="p-2">{t.action}</th><th className="p-2">{t.detail}</th></tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {shown.map((r) => (
                      <tr key={r.rowNumber} className={r.action === "error" ? "bg-red-50/50" : ""}>
                        <td className="p-2 align-top font-mono">{r.rowNumber}</td>
                        <td className="p-2 align-top"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE[r.action] ?? BADGE.unchanged}`}>{r.action}</span></td>
                        <td className="p-2 align-top">
                          <span className="font-medium">{r.label}</span>
                          {r.errors.map((e) => <p key={`${e.column}${e.message}`} className="text-red-800"><span className="font-mono text-xs">{e.column}</span>: {e.message}</p>)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {plan.canCommit ? (
            <div className="space-y-3 rounded-lg border border-ink/30 p-3">
              <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-0.5 h-5 w-5" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />{t.confirmBox}</label>
              <button onClick={commit} disabled={!confirmed || busy !== null} className={`${btn} w-full bg-ink text-white`}>{busy === "commit" ? t.committing : t.commit}</button>
            </div>
          ) : (
            <p className="rounded-lg bg-amber-50 p-3 text-sm font-medium text-amber-900">{t.blocked}</p>
          )}
        </section>
      )}
    </div>
  );
}
