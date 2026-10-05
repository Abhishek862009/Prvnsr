import ParentLoginForm from "@/components/parent/ParentLoginForm";
import { en } from "@/messages/en";

export const dynamic = "force-dynamic";

export default function ParentLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper p-6">
      <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-stone-500">Varindavan Boys Hostel</p>
        <h1 className="mb-5 mt-1 font-display text-2xl text-ink">{en.parent.login.title}</h1>
        <ParentLoginForm />
      </div>
    </main>
  );
}
