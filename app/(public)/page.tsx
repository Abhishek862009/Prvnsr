import Link from "next/link";
import ContactButtons from "@/components/public/ContactButtons";
import { gallery, roomTypes, site, trustPoints } from "@/content/site";
import { getPublicAvailabilitySafe } from "@/server/services/public-site";
import { getPublicSettingsSafe } from "@/server/services/settings";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [settings, availability] = await Promise.all([getPublicSettingsSafe(), getPublicAvailabilitySafe()]);
  const availableCount = availability?.rooms.filter((r) => r.status === "available").length ?? null;

  return (
    <>
      <section className="relative overflow-hidden bg-ink-deep text-white">
        <div aria-hidden="true" className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-marigold/20" />
        <div aria-hidden="true" className="absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-white/5" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 md:py-24">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-marigold">Student accommodation</p>
          <h1 className="max-w-3xl font-display text-4xl leading-tight md:text-6xl">{site.name}</h1>
          <p className="mt-4 max-w-xl text-lg text-white/85">{site.tagline}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/availability" className="inline-flex h-14 items-center rounded-lg bg-marigold px-6 text-lg font-semibold text-ink-deep">Check room availability</Link>
            <Link href="/enquiry" className="inline-flex h-14 items-center rounded-lg border border-white/50 px-6 text-lg font-semibold text-white">Send enquiry</Link>
          </div>
          <ContactButtons settings={settings} tone="light" className="mt-4" />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="font-display text-3xl text-ink">Why families trust us</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {trustPoints.map((t, i) => (
            <article key={t.title} className="rounded-2xl border border-stone-200 bg-white p-5">
              <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-marigold font-semibold text-ink-deep">{i + 1}</span>
              <h3 className="text-lg font-semibold text-ink">{t.title}</h3>
              <p className="mt-1 text-stone-700">{t.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-2">
          <div>
            <h2 className="font-display text-3xl text-ink">Rooms to suit you</h2>
            <p className="mt-2 text-stone-700">Choose a single or a double room. Fees are shared on enquiry - please contact us for pricing.</p>
            <ul className="mt-4 space-y-3">
              {roomTypes.map((r) => (
                <li key={r.name} className="rounded-xl border border-stone-200 p-4">
                  <h3 className="font-semibold text-ink">{r.name}</h3>
                  <p className="text-stone-700">{r.description}</p>
                </li>
              ))}
            </ul>
            <Link href="/rooms" className="mt-4 inline-block font-semibold text-ink underline">See room details</Link>
          </div>
          <div className="rounded-2xl bg-ink p-6 text-white">
            <p className="text-sm font-semibold uppercase tracking-widest text-marigold">Room availability</p>
            {availableCount !== null ? (
              <p className="mt-2 font-display text-5xl">{availableCount}<span className="ml-2 text-lg text-white/80">{availableCount === 1 ? "room" : "rooms"} available</span></p>
            ) : (
              <p className="mt-2 text-white/85">Check the availability page for the latest status.</p>
            )}
            <p className="mt-3 text-white/80">Availability is updated by the Warden. Refresh the page for the latest status.</p>
            <Link href="/availability" className="mt-5 inline-flex h-12 items-center rounded-lg bg-marigold px-5 font-semibold text-ink-deep">View all rooms</Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-display text-3xl text-ink">A look inside</h2>
          <Link href="/gallery" className="font-semibold text-ink underline">Full gallery</Link>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
          {gallery.slice(0, 3).map((g) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={g.src} src={g.src} alt={g.alt} width={640} height={400} loading="lazy" className="aspect-[8/5] w-full rounded-xl object-cover" />
          ))}
        </div>
      </section>

      <section className="bg-marigold">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-4 py-10 md:flex-row md:items-center">
          <div>
            <h2 className="font-display text-3xl text-ink-deep">Contact for pricing</h2>
            <p className="text-ink-deep/80">Tell us what you need and we will get back to you with fees and availability.</p>
          </div>
          <Link href="/enquiry" className="inline-flex h-14 items-center rounded-lg bg-ink-deep px-6 text-lg font-semibold text-white">Send enquiry</Link>
        </div>
      </section>
    </>
  );
}
