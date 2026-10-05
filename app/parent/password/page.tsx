import Link from "next/link";
import PasswordForm from "@/components/parent/PasswordForm";
import { requireParent } from "@/server/auth/guards";
import { en } from "@/messages/en";

export const dynamic = "force-dynamic";

export default async function ParentPasswordPage() {
  const parent = await requireParent({ allowPasswordChangePending: true });
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper p-6">
      <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-stone-500">Varindavan Boys Hostel</p>
        <h1 className="mb-5 mt-1 font-display text-2xl text-ink">{en.parent.password.title}</h1>
        <PasswordForm firstLogin={parent.mustChangePassword} />
        {!parent.mustChangePassword && (
          <Link href="/parent/dashboard" className="mt-4 block text-center text-sm text-ink underline">{en.parent.nav.dashboard}</Link>
        )}
      </div>
    </main>
  );
}
