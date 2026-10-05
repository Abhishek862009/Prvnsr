import type { Metadata } from "next";
import ContactButtons from "@/components/public/ContactButtons";
import EnquiryForm from "@/components/public/EnquiryForm";
import PageHeader from "@/components/public/PageHeader";
import { getPublicSettingsSafe } from "@/server/services/settings";

export const metadata: Metadata = { title: "Admission Enquiry" };
export const dynamic = "force-dynamic";

export default async function EnquiryPage() {
  const settings = await getPublicSettingsSafe();
  return (
    <>
      <PageHeader title="Admission enquiry" intro="Tell us what you are looking for. Fees are shared on enquiry - contact us for pricing." />
      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-[1fr_20rem]">
        <EnquiryForm />
        <aside className="space-y-3 self-start rounded-2xl bg-white p-5">
          <h2 className="font-display text-xl text-ink">Prefer to talk?</h2>
          <p className="text-stone-700">You can also reach the hostel directly.</p>
          <ContactButtons settings={settings} />
        </aside>
      </section>
    </>
  );
}
