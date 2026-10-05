"use client";

import { useRouter } from "next/navigation";

type Props = {
  /** wa.me link with the report pre-filled; null when the parent has no usable WhatsApp number. */
  href: string | null;
  checkId: string;
  /** Revision embedded in `href`; logged so edits after WhatsApp can be detected. */
  revision: number;
  label: string;
  /** Shown when href is null. */
  reason: string | null;
};

const base = "flex h-12 items-center justify-center rounded-lg px-5 text-base font-semibold";

/**
 * A real link: WhatsApp opens with the text pre-filled and the Warden presses Send himself.
 * Tapping also logs the "open" in the background. Nothing is sent by the system.
 */
export default function WhatsAppButton({ href, checkId, revision, label, reason }: Props) {
  const router = useRouter();

  if (!href) {
    return (
      <div>
        <button type="button" disabled className={`${base} w-full cursor-not-allowed bg-stone-200 text-stone-500 sm:w-auto`}>{label}</button>
        {reason && <p className="mt-1 text-sm text-stone-600">{reason}</p>}
      </div>
    );
  }

  function logOpen() {
    void fetch(`/api/admin/reports/${checkId}/whatsapp-open`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revision }),
      keepalive: true,
    })
      .then(() => router.refresh())
      .catch(() => undefined);
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={logOpen} className={`${base} w-full bg-[#1f7a4d] text-white sm:w-auto`}>
      {label}
    </a>
  );
}
