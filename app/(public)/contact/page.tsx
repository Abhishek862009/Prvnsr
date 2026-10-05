import type { Metadata } from "next";
import Link from "next/link";
import ContactButtons from "@/components/public/ContactButtons";
import PageHeader from "@/components/public/PageHeader";
import { location } from "@/content/site";
import { getPublicSettingsSafe } from "@/server/services/settings";

export const metadata: Metadata = { title: "Contact" };
export const dynamic = "force-dynamic";

const pretty = (e164: string) => e164.replace(/^\+91(\d{5})(\d{5})$/, "+91 $1 $2");

export default async function ContactPage() {
  const settings = await getPublicSettingsSafe();
  const card = "rounded-2xl border border-stone-200 bg-white p-5";
  return (
    <>
      <PageHeader title="Contact us" intro="We are happy to answer questions from students and parents." />
      <section className="mx-auto grid max-w-6xl gap-5 px-4 py-10 md:grid-cols-3">
        <div className={card}>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Phone and WhatsApp</h2>
          {settings.callNumber && <p className="mt-2 text-lg">Call: {pretty(settings.callNumber)}</p>}
          {settings.whatsappNumber && <p className="text-lg">WhatsApp: {pretty(settings.whatsappNumber)}</p>}
          {!settings.callNumber && !settings.whatsappNumber && <p className="mt-2 text-stone-700">Please use the enquiry form and we will contact you.</p>}
          <ContactButtons settings={settings} className="mt-4" />
        </div>
        <div className={card}>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Address</h2>
          <p className="mt-2 text-lg">{location.address}</p>
          <Link href="/location" className="mt-3 inline-block font-semibold text-ink underline">Map and directions</Link>
        </div>
        <div className={card}>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Admission and fees</h2>
          <p className="mt-2 text-stone-700">Fees are not listed online. Contact us for pricing.</p>
          <Link href="/enquiry" className="mt-4 inline-flex h-12 items-center rounded-lg bg-ink px-5 font-semibold text-white">Send enquiry</Link>
        </div>
      </section>
    </>
  );
}
