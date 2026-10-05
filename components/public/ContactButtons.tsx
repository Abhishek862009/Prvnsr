import { buildWhatsAppLink } from "@/server/lib/whatsapp";
import { telHref, type PublicSettings } from "@/server/lib/public-data";

const GREETING = "Hello, I would like to know more about Varindavan Boys Hostel.";

/**
 * Call + WhatsApp buttons. The numbers come from Admin > Settings; a number that is not set
 * simply does not render (no fake numbers, no dead buttons).
 */
export default function ContactButtons({
  settings,
  tone = "dark",
  size = "md",
  className = "",
}: {
  settings: PublicSettings;
  tone?: "dark" | "light";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const h = size === "lg" ? "h-14 text-lg" : size === "sm" ? "h-10 text-sm" : "h-12 text-base";
  const base = `inline-flex ${h} items-center justify-center gap-2 rounded-lg px-5 font-semibold`;
  const call = tone === "light" ? "bg-white text-ink" : "bg-ink text-white";
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {settings.callNumber && (
        <a href={telHref(settings.callNumber)} className={`${base} ${call}`}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true"><path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.6 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.6 3.6a1 1 0 0 1-.25 1z" /></svg>
          Call
        </a>
      )}
      {settings.whatsappNumber && (
        <a href={buildWhatsAppLink(settings.whatsappNumber, GREETING)} target="_blank" rel="noopener noreferrer" className={`${base} bg-[#1f7a4d] text-white`}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.2 13.9c-.2.6-1.2 1.2-1.7 1.2-.5.1-1 .2-3.3-.7a11 11 0 0 1-4.5-4c-.4-.5-1.2-1.6-1.2-2.9 0-1.2.6-1.8.9-2.1.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .6l-.4.6c-.2.2-.3.4-.1.7.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.7-.1l.9-1.1c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.6.3.1.2.1.8-.1 1.6z" /></svg>
          WhatsApp
        </a>
      )}
    </div>
  );
}
