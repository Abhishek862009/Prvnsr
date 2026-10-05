import type { Metadata } from "next";
import PageHeader from "@/components/public/PageHeader";
import { gallery } from "@/content/site";

export const metadata: Metadata = { title: "Photo Gallery" };

// Static images from /public/gallery. There is no upload or management screen by design.
export default function GalleryPage() {
  return (
    <>
      <PageHeader title="Photo gallery" intro="A look at life and facilities at the hostel." />
      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-10 sm:grid-cols-2 lg:grid-cols-3">
        {gallery.map((g) => (
          <figure key={g.src} className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={g.src} alt={g.alt} width={640} height={400} loading="lazy" className="aspect-[8/5] w-full object-cover" />
            <figcaption className="p-3 text-sm text-stone-700">{g.caption}</figcaption>
          </figure>
        ))}
      </section>
    </>
  );
}
