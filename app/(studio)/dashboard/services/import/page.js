// Services → Import from another app (free on every plan). Upload
// screenshots of your old menu, check what we read, then add it to your
// page. ?id=<import> shows that import's review (or its result).
import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/user";
import { createClient } from "@/lib/supabase/server";
import { BRAND_NAME } from "@/lib/brand";
import PageHeader from "@/components/dash/PageHeader";
import { cleanExtracted, flagRows, IMPORT_MAX_SCREENSHOTS } from "@/lib/serviceImport";
import ImportUploader from "./ImportUploader";
import ReviewTable from "./ReviewTable";

export const metadata = { title: `Import your services · ${BRAND_NAME}` };
// Reading 10 screenshots can take a minute.
export const maxDuration = 300;

const UUID = /^[0-9a-f-]{36}$/i;

export default async function ImportServicesPage({ searchParams }) {
  const user = await getUser();
  if (!user) redirect("/login");
  const supabase = await createClient();
  const { id } = await searchParams;

  let imp = null;
  if (id && UUID.test(String(id))) {
    const { data } = await supabase
      .from("service_imports")
      .select("id, status, extracted, error, approved_at")
      .eq("id", id)
      .maybeSingle();
    imp = data;
  }

  const header = (
    <>
      <p className="small-text">
        <Link href="/dashboard/services">← Services</Link>
      </p>
      <PageHeader
        guide="service_import"
        eyebrow="Free on every plan"
        title="Import your services"
        subtitle="Switching is free. Upload screenshots of your menu from any app, check what we read, and add it to your page."
      />
    </>
  );

  if (imp?.status === "review") {
    const { data: existing } = await supabase.from("services").select("name");
    const rows = flagRows(cleanExtracted(imp.extracted), (existing || []).map((s) => s.name));
    const unreadable = (imp.extracted?.unreadable || []).filter((n) => Number.isInteger(n));
    return (
      <>
        {header}
        {unreadable.length > 0 && (
          <p className="message info">
            We couldn&apos;t read screenshot {unreadable.join(", ")}. Check below for anything missing, or add it with + Add a service.
          </p>
        )}
        <ReviewTable importId={imp.id} initialRows={rows} existingNames={(existing || []).map((s) => s.name)} />
      </>
    );
  }

  if (imp?.status === "approved") {
    const n = (imp.extracted?.approved || []).length;
    return (
      <>
        {header}
        <section className="card si-done">
          <h2>Done. {n} {n === 1 ? "service was" : "services were"} added.</h2>
          <p>They&apos;re on your booking page now. Next, open some times so clients can book.</p>
          <div className="si-done-actions">
            <Link href="/dashboard/services" className="button">See my services</Link>
            <Link href="/dashboard/openings" className="button secondary">Open some times</Link>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      {header}
      {imp?.status === "failed" && imp.error && <p className="message error">{imp.error}</p>}
      <ImportUploader max={IMPORT_MAX_SCREENSHOTS} />
    </>
  );
}
