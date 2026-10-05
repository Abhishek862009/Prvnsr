"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { en } from "@/messages/en";

const t = en.admin.backup;
type Counts = Record<string, number>;
type Preview = {
  schemaVersion: number;
  exportedAt: string;
  timezone: string;
  willRestore: Counts;
  droppedExpired: Counts;
};
type ApiErr = { error?: { message?: string; details?: { errors?: string[] } } };

const box = "rounded-2xl border border-stone-300 bg-white p-4 space-y-3";
const field = "mt-1 h-12 w-full rounded-lg border border-stone-300 bg-white px-3 text-base outline-none focus:border-ink focus:ring-2 focus:ring-ink/20";
const label = (k: string) => k.replace(/_/g, " ");

async function readError(res: Response): Promise<string> {
  const j = (await res.json().catch(() => null)) as ApiErr | null;
  const extra = j?.error?.details?.errors?.length ? ` (${j.error.details.errors.slice(0, 3).join("; ")})` : "";
  return (j?.error?.message ?? en.http.serverError) + extra;
}

export default function BackupPanel() {
  const router = useRouter();
  // ---- download
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [dlBusy, setDlBusy] = useState(false);
  const [dlMsg, setDlMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // ---- restore
  const fileRef = useRef<HTMLInputElement>(null);
  const [rpw, setRpw] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [rErr, setRErr] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [done, setDone] = useState(false);

  async function download(e: FormEvent) {
    e.preventDefault();
    setDlBusy(true);
    setDlMsg(null);
    try {
      const res = await fetch("/api/admin/backup/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw, confirmPassword: pw2 }),
      });
      if (res.status === 401) return router.push("/admin/login");
      if (!res.ok) return setDlMsg({ ok: false, text: await readError(res) });
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "varindavan-backup.zip";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
      setPw("");
      setPw2("");
      setDlMsg({ ok: true, text: t.downloaded });
    } catch {
      setDlMsg({ ok: false, text: en.http.serverError });
    } finally {
      setDlBusy(false);
    }
  }

  function form(extra?: Record<string, string>) {
    const f = new FormData();
    const file = fileRef.current?.files?.[0];
    if (file) f.append("file", file);
    f.append("password", rpw);
    for (const [k, v] of Object.entries(extra ?? {})) f.append(k, v);
    return f;
  }

  async function check(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setRErr(null);
    setPreview(null);
    setDone(false);
    try {
      if (!fileRef.current?.files?.[0]) return setRErr("Choose the backup ZIP file first.");
      const res = await fetch("/api/admin/backup/restore/validate", { method: "POST", body: form() });
      if (res.status === 401) return router.push("/admin/login");
      if (!res.ok) return setRErr(await readError(res));
      setPreview(((await res.json()) as { preview: Preview }).preview);
      setTyped("");
      setUnderstood(false);
    } catch {
      setRErr(en.http.serverError);
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    setBusy(true);
    setRErr(null);
    try {
      const res = await fetch("/api/admin/backup/restore/commit", { method: "POST", body: form({ confirm: typed }) });
      if (res.status === 401) return router.push("/admin/login");
      if (!res.ok) return setRErr(await readError(res));
      setDone(true);
      setPreview(null);
      setRpw("");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch {
      setRErr(en.http.serverError);
    } finally {
      setBusy(false);
    }
  }

  const canRestore = !!preview && typed === "RESTORE" && understood && !busy;
  return (
    <div className="space-y-5">
      <section className={box} aria-labelledby="dl">
        <h2 id="dl" className="font-display text-2xl text-ink">{t.downloadTitle}</h2>
        <p className="text-stone-700">{t.downloadIntro}</p>
        <form onSubmit={download} className="space-y-3">
          <label className="block text-sm font-medium">{t.password}
            <input className={field} type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" minLength={12} required />
          </label>
          <label className="block text-sm font-medium">{t.confirmPassword}
            <input className={field} type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" minLength={12} required />
          </label>
          <p className="text-xs text-stone-600">{t.passwordHint}</p>
          <p role="note" className="rounded-lg bg-amber-50 p-3 text-sm font-medium text-amber-900">{t.warning}</p>
          {dlMsg && <p role={dlMsg.ok ? "status" : "alert"} className={`text-sm ${dlMsg.ok ? "text-status-complete" : "text-red-700"}`}>{dlMsg.text}</p>}
          <button disabled={dlBusy} className="h-12 w-full rounded-lg bg-ink text-base font-semibold text-white disabled:opacity-60">{dlBusy ? t.working : t.download}</button>
        </form>
      </section>

      <section className={box} aria-labelledby="rs">
        <h2 id="rs" className="font-display text-2xl text-ink">{t.restoreTitle}</h2>
        <p className="text-stone-700">{t.restoreIntro}</p>
        <form onSubmit={check} className="space-y-3">
          <label className="block text-sm font-medium">{t.file}
            <input ref={fileRef} type="file" accept=".zip,application/zip" className="mt-1 block w-full text-sm" required />
          </label>
          <label className="block text-sm font-medium">{t.password}
            <input className={field} type="password" value={rpw} onChange={(e) => setRpw(e.target.value)} autoComplete="off" required />
          </label>
          <p role="note" className="rounded-lg bg-amber-50 p-3 text-sm font-medium text-amber-900">{t.warning}</p>
          {rErr && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{rErr}</p>}
          <button disabled={busy} className="h-12 w-full rounded-lg border border-ink text-base font-semibold text-ink disabled:opacity-60">{busy && !preview ? t.checking : t.check}</button>
        </form>

        {preview && (
          <div className="space-y-3 rounded-xl border border-status-complete/40 p-3">
            <h3 className="font-semibold text-status-complete">{t.summaryTitle}</h3>
            <p className="text-sm text-stone-700">{t.exportedAt}: {new Date(preview.exportedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} · {t.schema}: {preview.schemaVersion} · {t.timezone}: {preview.timezone}</p>
            <div>
              <p className="text-sm font-semibold">{t.willRestore}</p>
              <ul className="mt-1 grid grid-cols-2 gap-x-4 text-sm">
                {Object.entries(preview.willRestore).map(([k, v]) => <li key={k} className="flex justify-between border-b border-stone-100 py-0.5"><span className="capitalize">{label(k)}</span><span className="font-medium">{v}</span></li>)}
              </ul>
            </div>
            {Object.values(preview.droppedExpired).some((n) => n > 0) && (
              <p className="text-sm text-stone-700">{t.expired}: {Object.entries(preview.droppedExpired).filter(([, n]) => n > 0).map(([k, n]) => `${label(k)} ${n}`).join(", ")}</p>
            )}
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-900">{t.restoreWarning}</p>
            <p className="text-sm text-stone-700">{t.safetyNote}</p>
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} className="mt-1 h-5 w-5" />{t.understand}</label>
            <label className="block text-sm font-medium">{t.typeConfirm}
              <input className={field} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
            </label>
            <button type="button" onClick={restore} disabled={!canRestore} className="h-12 w-full rounded-lg bg-red-700 text-base font-semibold text-white disabled:opacity-40">{busy ? t.restoring : t.restore}</button>
          </div>
        )}

        {done && (
          <div role="status" className="space-y-2 rounded-xl bg-green-50 p-3 text-sm text-green-900">
            <p className="font-semibold">{t.restored}</p>
            <a href="/api/admin/backup/safety" className="font-medium underline">{t.safetyDownload}</a>
          </div>
        )}
      </section>
    </div>
  );
}
