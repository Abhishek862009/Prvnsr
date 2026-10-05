import Link from "next/link";
import LogoutButton from "@/components/admin/LogoutButton";
import { requireWarden } from "@/server/auth/guards";
import { en } from "@/messages/en";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  await requireWarden();
  return (
    <div className="min-h-screen bg-paper text-stone-900">
      <header className="sticky top-0 z-10 bg-ink text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/admin/dashboard" className="leading-tight">
            <span className="block text-[11px] uppercase tracking-widest text-white/70">Varindavan Boys Hostel</span>
            <span className="font-display text-lg">{en.admin.panelTitle}</span>
          </Link>
          <LogoutButton />
        </div>
        <nav aria-label="Warden sections" className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-3 pb-2 text-sm">
          {[
            { href: "/admin/dashboard", label: en.admin.nav.dashboard },
            { href: "/admin/search", label: en.admin.nav.search },
            { href: "/admin/history", label: en.admin.nav.history },
            { href: "/admin/reports", label: en.admin.nav.reports },
            { href: "/admin/rooms", label: en.admin.nav.rooms },
            { href: "/admin/students", label: en.admin.nav.students },
            { href: "/admin/parents", label: en.admin.nav.parents },
            { href: "/admin/availability", label: en.admin.nav.availability },
            { href: "/admin/enquiries", label: en.admin.nav.enquiries },
            { href: "/admin/settings", label: en.admin.nav.settings },
            { href: "/admin/backup", label: en.admin.nav.backup },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="flex h-10 shrink-0 items-center rounded-lg px-3 text-white/85 hover:bg-white/10 hover:text-white">{l.label}</Link>
          ))}
        </nav>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-5">{children}</div>
    </div>
  );
}
