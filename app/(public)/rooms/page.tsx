import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/public/PageHeader";
import { roomTypes } from "@/content/site";

export const metadata: Metadata = { title: "Rooms" };

export default function RoomsPage() {
  return (
    <>
      <PageHeader title="Rooms" intro="Single and double rooms. Fees are not listed online - contact us for pricing." />
      <section className="mx-auto grid max-w-6xl gap-5 px-4 py-10 md:grid-cols-2">
        {roomTypes.map((r) => (
          <article key={r.name} className="flex flex-col rounded-2xl border border-stone-200 bg-white p-6">
            <h2 className="font-display text-2xl text-ink">{r.name}</h2>
            <p className="mt-2 text-stone-700">{r.description}</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-stone-700">
              {r.points.map((p) => <li key={p}>{p}</li>)}
            </ul>
            <div className="mt-5 rounded-lg bg-paper p-3 text-sm font-medium text-stone-800">Fees: Contact for Pricing</div>
            <Link href="/enquiry" className="mt-4 inline-flex h-12 items-center justify-center rounded-lg bg-ink px-5 font-semibold text-white">Contact for Pricing</Link>
          </article>
        ))}
      </section>
      <p className="mx-auto max-w-6xl px-4 pb-10"><Link href="/availability" className="font-semibold text-ink underline">See which rooms are available</Link></p>
    </>
  );
}
