import Link from "next/link";
import { buildWhatsAppLink } from "@/server/lib/whatsapp";
import { telHref, type PublicSettings } from "@/server/lib/public-data";

/** Always-visible Call / WhatsApp bar on phones. Falls back to "Send Enquiry" if no number is set. */
export default function StickyContact({ settings }: { settings: PublicSettings }) {
  const btn = "flex h-12 flex-1 items-center justify-center rounded-lg text-base font-semibold";
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-300 bg-white/95 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-md gap-2">
        {settings.callNumber && <a href={telHref(settings.callNumber)} className={`${btn} bg-ink text-white`}>Call</a>}
        {settings.whatsappNumber && (
          <a href={buildWhatsAppLink(settings.whatsappNumber, "Hello, I would like to know more about Varindavan Boys Hostel.")} target="_blank" rel="noopener noreferrer" className={`${btn} bg-[#1f7a4d] text-white`}>WhatsApp</a>
        )}
        {!settings.callNumber && !settings.whatsappNumber && <Link href="/enquiry" className={`${btn} bg-ink text-white`}>Send Enquiry</Link>}
      </div>
    </div>
  );
}
