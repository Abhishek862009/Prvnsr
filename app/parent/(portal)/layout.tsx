import ParentLogoutButton from "@/components/parent/ParentLogoutButton";
import { requireParent } from "@/server/auth/guards";
import { en } from "@/messages/en";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  // Redirects to /parent/login, or to /parent/password while a first-login change is pending.
  await requireParent();
  return (
    <div className="min-h-screen bg-paper text-stone-900">
      <header className="bg-ink text-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <div className="leading-tight">
            <span className="block text-[11px] uppercase tracking-widest text-white/70">Varindavan Boys Hostel</span>
            <span className="font-display text-lg">{en.parent.portalTitle}</span>
          </div>
          <ParentLogoutButton />
        </div>
      </header>
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-5">{children}</div>
    </div>
  );
}
