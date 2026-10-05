import type { Metadata } from "next";
import ContactButtons from "@/components/public/ContactButtons";
import PageHeader from "@/components/public/PageHeader";
import { location } from "@/content/site";
import { getPublicSettingsSafe } from "@/server/services/settings";

export const metadata: Metadata = { title: "Location" };
export const dynamic = "force-dynamic";

export default async function LocationPage() {
  const settings = await getPublicSettingsSafe();
  const q = location.mapsQuery.trim();
  return (
    <>
      <PageHeader title="Location" intro="How to find us." />
      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-10 md:grid-cols-2">
        <div className="space-y-4">
          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Address</h2>
            <p className="mt-1 text-lg">{location.address}</p>
            <p className="mt-2 text-stone-700">{location.landmark}</p>
          </div>
          {q && (
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center rounded-lg bg-ink px-5 font-semibold text-white">Get directions</a>
          )}
          <ContactButtons settings={settings} />
        </div>
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
          {q ? (
            <iframe title="Map showing the hostel location" src={`https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`} className="h-80 w-full md:h-full md:min-h-80" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
          ) : (
            <div className="flex h-80 items-center justify-center p-6 text-center text-stone-600">The map will appear here once the hostel&apos;s map location is added.</div>
          )}
        </div>
      </section>
    </>
  );
}
