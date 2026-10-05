import Link from "next/link";
import LoginForm from "@/components/admin/LoginForm";
import { en } from "@/messages/en";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper p-6">
      <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-stone-500">Varindavan Boys Hostel</p>
        <h1 className="mb-5 mt-1 font-display text-2xl text-ink">{en.admin.login.title}</h1>
        <LoginForm notice={reason === "replaced" ? en.auth.replacedSession : undefined} />
        <p className="mt-4 text-center text-sm"><Link href="/admin/recover" className="text-ink underline">{en.admin.recover.forgot}</Link></p>
      </div>
    </main>
  );
}
