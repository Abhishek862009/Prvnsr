import type { Metadata } from "next";
import PageHeader from "@/components/public/PageHeader";
import { facilities } from "@/content/site";

export const metadata: Metadata = { title: "Facilities" };

export default function FacilitiesPage() {
  return (
    <>
      <PageHeader title="Facilities" intro="What residents can expect at the hostel." />
      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        {facilities.map((f) => (
          <article key={f.title} className="rounded-2xl border border-stone-200 bg-white p-5">
            <span aria-hidden="true" className="mb-3 block h-2 w-10 rounded bg-marigold" />
            <h2 className="text-lg font-semibold text-ink">{f.title}</h2>
            <p className="mt-1 text-stone-700">{f.body}</p>
          </article>
        ))}
      </section>
    </>
  );
}
