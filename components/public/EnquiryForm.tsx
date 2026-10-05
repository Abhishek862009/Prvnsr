"use client";

import { useState, type FormEvent } from "react";

type FieldErrors = Record<string, string>;

const field = "mt-1 h-12 w-full rounded-lg border border-stone-300 bg-white px-3 text-base outline-none focus:border-ink focus:ring-2 focus:ring-ink/20";
const label = "block text-sm font-medium text-stone-800";

export default function EnquiryForm() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      const res = await fetch("/api/public/enquiry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (res.ok) {
        setDone(true);
        form.reset();
        return;
      }
      const json = (await res.json().catch(() => null)) as { error?: { message?: string; details?: { errors?: { field: string; message: string }[] } } } | null;
      const list = json?.error?.details?.errors;
      if (list?.length) setErrors(Object.fromEntries(list.map((x) => [x.field, x.message])));
      setFormError(json?.error?.message ?? "Something went wrong. Please try again or call us.");
    } catch {
      setFormError("Something went wrong. Please try again or call us.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div role="status" className="rounded-2xl border border-status-complete/40 bg-white p-6">
        <h2 className="font-display text-2xl text-ink">Thank you</h2>
        <p className="mt-2 text-stone-700">We have received your enquiry. The hostel will contact you on the phone number you gave.</p>
        <button type="button" onClick={() => setDone(false)} className="mt-4 h-12 rounded-lg border border-ink px-5 font-semibold text-ink">Send another enquiry</button>
      </div>
    );
  }

  const err = (k: string) => errors[k] && <span role="alert" className="mt-1 block text-sm text-red-700">{errors[k]}</span>;
  const minDate = new Date().toISOString().slice(0, 10);

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      {/* Honeypot: hidden from people; bots tend to fill every field. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>Website<input type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>

      <label className={label}>Name
        <input className={field} name="name" autoComplete="name" required maxLength={100} />
        {err("name")}
      </label>
      <label className={label}>Phone
        <input className={field} name="phone" type="tel" inputMode="tel" autoComplete="tel" required />
        {err("phone")}
      </label>
      <label className={label}>Email <span className="font-normal text-stone-500">(optional)</span>
        <input className={field} name="email" type="email" autoComplete="email" />
        {err("email")}
      </label>
      <label className={label}>Preferred room type
        <select className={field} name="preferredRoomType" defaultValue="" required>
          <option value="" disabled>Choose one</option>
          <option value="single">Single room</option>
          <option value="double">Double room</option>
          <option value="any">No preference</option>
        </select>
        {err("preferredRoomType")}
      </label>
      <label className={label}>Expected joining date
        <input className={field} name="expectedJoiningDate" type="date" min={minDate} required />
        {err("expectedJoiningDate")}
      </label>
      <label className={label}>Message
        <textarea className="mt-1 w-full rounded-lg border border-stone-300 bg-white p-3 text-base outline-none focus:border-ink focus:ring-2 focus:ring-ink/20" name="message" rows={4} maxLength={1000} required />
        {err("message")}
      </label>

      {formError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{formError}</p>}
      <button disabled={busy} className="h-12 w-full rounded-lg bg-ink text-base font-semibold text-white disabled:opacity-60">{busy ? "Sending..." : "Send enquiry"}</button>
      <p className="text-xs text-stone-600">Fees are not listed online. Send an enquiry and we will share pricing and availability.</p>
    </form>
  );
}
