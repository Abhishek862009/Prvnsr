import type { Metadata } from "next";
import PageHeader from "@/components/public/PageHeader";
import { about, site } from "@/content/site";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <>
      <PageHeader title={about.heading} intro={site.shortAbout} />
      <section className="mx-auto max-w-6xl space-y-4 px-4 py-10">
        <div className="max-w-3xl space-y-4 text-lg text-stone-800">
          {about.paragraphs.map((p) => <p key={p}>{p}</p>)}
        </div>
        <div className="grid gap-4 pt-4 md:grid-cols-3">
          {about.values.map((v) => (
            <article key={v.title} className="rounded-2xl border border-stone-200 bg-white p-5">
              <h2 className="text-lg font-semibold text-ink">{v.title}</h2>
              <p className="mt-1 text-stone-700">{v.body}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
