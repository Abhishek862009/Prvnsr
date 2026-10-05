import RecoverForm from "@/components/admin/RecoverForm";
import { en } from "@/messages/en";

export const dynamic = "force-dynamic";

// Public by necessity (the Warden cannot sign in), so it protects itself: same-origin only, DB-based
// throttling on the API, a generic error for a wrong key, and every Warden session ends on success.
export default function AdminRecoverPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper p-6">
      <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-stone-500">Varindavan Boys Hostel</p>
        <h1 className="mb-4 mt-1 font-display text-2xl text-ink">{en.admin.recover.title}</h1>
        <RecoverForm />
      </div>
    </main>
  );
}
