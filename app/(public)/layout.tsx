import type { Metadata } from "next";
import SiteFooter from "@/components/public/SiteFooter";
import SiteHeader from "@/components/public/SiteHeader";
import StickyContact from "@/components/public/StickyContact";
import { site } from "@/content/site";
import { getPublicSettingsSafe } from "@/server/services/settings";

// Numbers and availability are edited by the Warden, so public pages are never statically cached.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: `${site.name} - safe, disciplined student accommodation`, template: `%s | ${site.name}` },
  description: site.shortAbout,
};

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const settings = await getPublicSettingsSafe();
  return (
    <div className="flex min-h-screen flex-col bg-paper text-stone-900">
      <SiteHeader settings={settings} />
      <main className="flex-1">{children}</main>
      {/* Extra bottom space on phones so the sticky Call/WhatsApp bar never covers the footer. */}
      <div className="bg-ink-deep pb-[76px] md:pb-0">
        <SiteFooter settings={settings} />
      </div>
      <StickyContact settings={settings} />
    </div>
  );
}
