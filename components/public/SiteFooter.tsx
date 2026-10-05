import Link from "next/link";
import { nav, site } from "@/content/site";
import type { PublicSettings } from "@/server/lib/public-data";
import ContactButtons from "./ContactButtons";

const pretty = (e164: string) => e164.replace(/^\+91(\d{5})(\d{5})$/, "+91 $1 $2");

export default function SiteFooter({ settings }: { settings: PublicSettings }) {
  return (
    <footer className="bg-ink-deep text-white/80">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-3">
        <div>
          <p className="font-display text-xl text-white">{site.name}</p>
          <p className="mt-2 text-sm">{site.shortAbout}</p>
        </div>
        <nav aria-label="Footer">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-marigold">Explore</p>
          <ul className="grid grid-cols-2 gap-1 text-sm">
            {[...nav.filter((n) => n.href !== "/"), { href: "/enquiry", label: "Enquiry" }].map((i) => (
              <li key={i.href}><Link href={i.href} className="hover:text-white">{i.label}</Link></li>
            ))}
          </ul>
        </nav>
        <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-marigold">Get in touch</p>
          {settings.callNumber && <p className="text-sm">Call: {pretty(settings.callNumber)}</p>}
          {settings.whatsappNumber && <p className="text-sm">WhatsApp: {pretty(settings.whatsappNumber)}</p>}
          <p className="mt-1 text-sm">Fees: contact us for pricing.</p>
          <ContactButtons settings={settings} tone="light" size="sm" className="mt-3" />
          <Link href="/parent/login" className="mt-4 inline-block text-sm underline hover:text-white">Parent login</Link>
        </div>
      </div>
      <p className="border-t border-white/10 px-4 py-4 text-center text-xs text-white/60">© {new Date().getFullYear()} {site.name}</p>
    </footer>
  );
}
