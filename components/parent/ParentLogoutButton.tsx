"use client";

import { useRouter } from "next/navigation";
import { en } from "@/messages/en";

export default function ParentLogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/parent/logout", { method: "POST" }).catch(() => undefined);
    router.push("/parent/login");
    router.refresh();
  }
  return (
    <button onClick={logout} className="h-10 rounded-lg border border-white/30 px-3 text-sm text-white hover:bg-white/10">
      {en.parent.nav.logout}
    </button>
  );
}
