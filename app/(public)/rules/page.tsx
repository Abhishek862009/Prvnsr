import type { Metadata } from "next";
import PageHeader from "@/components/public/PageHeader";
import { rules } from "@/content/site";

export const metadata: Metadata = { title: "Rules" };

export default function RulesPage() {
  return (
    <>
      <PageHeader title="Hostel rules" intro="Simple rules that keep the hostel safe and comfortable for everyone." />
      <section className="mx-auto max-w-3xl px-4 py-10">
        <ol className="space-y-3">
          {rules.map((r, i) => (
            <li key={r} className="flex gap-4 rounded-xl border border-stone-200 bg-white p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink font-semibold text-white">{i + 1}</span>
              <p className="pt-0.5 text-stone-800">{r}</p>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
