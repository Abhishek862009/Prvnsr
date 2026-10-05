import Link from "next/link";
import { nav, site } from "@/content/site";
import type { PublicSettings } from "@/server/lib/public-data";
import ContactButtons from "./ContactButtons";
import Logo from "./Logo";
import Nav from "./Nav";

export default function SiteHeader({ settings }: { settings: PublicSettings }) {
  return (
    <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/95 backdrop-blur">
      <div className="relative mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo />
          <span className="font-display text-lg leading-tight text-ink">{site.name}</span>
        </Link>
        <Nav items={nav} />
        <ContactButtons settings={settings} size="sm" className="hidden md:flex" />
      </div>
    </header>
  );
}
