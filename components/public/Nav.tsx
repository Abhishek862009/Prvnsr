"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Item = { href: string; label: string };

export default function Nav({ items }: { items: Item[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const on = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  return (
    <>
      <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
        {items.map((i) => (
          <Link key={i.href} href={i.href} aria-current={on(i.href) ? "page" : undefined} className={`rounded-md px-3 py-2 text-sm font-medium ${on(i.href) ? "bg-ink/10 text-ink" : "text-stone-700 hover:text-ink"}`}>
            {i.label}
          </Link>
        ))}
      </nav>

      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="mobile-menu" className="flex h-11 items-center gap-2 rounded-lg border border-stone-300 px-3 text-sm font-semibold text-ink lg:hidden">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
        Menu
      </button>

      {open && (
        <nav id="mobile-menu" aria-label="Mobile" className="absolute inset-x-0 top-full border-b border-stone-200 bg-white shadow-lg lg:hidden">
          <ul className="mx-auto grid max-w-6xl grid-cols-2 gap-1 p-3">
            {[...items, { href: "/enquiry", label: "Send Enquiry" }].map((i) => (
              <li key={i.href}>
                <Link href={i.href} aria-current={on(i.href) ? "page" : undefined} className={`flex h-12 items-center rounded-lg px-3 font-medium ${on(i.href) ? "bg-ink text-white" : "text-ink hover:bg-stone-100"}`}>{i.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </>
  );
}
