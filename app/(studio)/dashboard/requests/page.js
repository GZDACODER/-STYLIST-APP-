// Requests: clients' requests for services the pro approves first (step 56
// SQL), newest first, with their reference photos.
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BRAND_NAME } from "@/lib/brand";
import PageHeader from "@/components/dash/PageHeader";
import EmptyState from "@/components/dash/EmptyState";
import RequestActions from "./RequestActions";

export const metadata = { title: `Requests · ${BRAND_NAME}` };

const when = (iso, timeZone) => {
  const opts = { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" };
  try {
    return new Date(iso).toLocaleString("en-US", { ...opts, timeZone: timeZone || "America/Chicago" });
  } catch {
    return new Date(iso).toLocaleString("en-US", opts);
  }
};
const STATUS = { new: "New", approved: "Approved · link sent", declined: "Declined", booked: "Booked" };

export default async function RequestsPage({ searchParams }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { show } = await searchParams;
  const tab = ["new", "approved", "declined", "booked"].includes(show) ? show : "new";
  const [{ data: rows, error }, { data: services }, { data: me }] = await Promise.all([
    supabase.from("booking_requests").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("services").select("id, name").order("name"),
    supabase.from("stylists").select("timezone").eq("id", user.id).maybeSingle(),
  ]);
  const all = rows || [];
  const list = all.filter((r) => r.status === tab);
  // Short-lived links to the reference photos.
  const paths = list.flatMap((r) => r.photos || []);
  const urlOf = {};
  if (paths.length) {
    const { data } = await createAdminClient().storage.from("booking-photos").createSignedUrls(paths, 3600);
    for (const d of data || []) if (d.signedUrl) urlOf[d.path] = d.signedUrl;
  }
  const count = (st) => all.filter((r) => r.status === st).length;

  return (
    <>
      <PageHeader guide="requests" title="Requests" subtitle="Clients send their idea and photos; you approve before they book." />
      {error && <p className="message error">Requests aren&apos;t set up yet (step 56 SQL).</p>}
      <nav className="cr-tabs" aria-label="Request status">
        {["new", "approved", "booked", "declined"].map((st) => (
          <a key={st} href={`/dashboard/requests?show=${st}`} className={tab === st ? "cr-tab active" : "cr-tab"}>
            {st[0].toUpperCase() + st.slice(1)} ({count(st)})
          </a>
        ))}
      </nav>
      {list.length === 0 ? (
        <EmptyState
          title={tab === "new" ? "No new requests" : "Nothing here"}
          text="Turn on 'Ask for a request first' on any service, and clients send you their idea before booking."
          action={
            <Link href="/dashboard/services" className="button small secondary">
              Open Services
            </Link>
          }
        />
      ) : (
        <ul className="rq-list">
          {list.map((r) => (
            <li key={r.id} className="card">
              <p className="rq-head">
                <strong>{r.client_name}</strong>
                <span className="badge">{STATUS[r.status]}</span>
              </p>
              <p className="muted small-text">
                {r.service_name} · {when(r.created_at, me?.timezone)} · <a href={`mailto:${r.client_email}`}>{r.client_email}</a>
                {r.client_phone ? ` · ${r.client_phone}` : ""}
              </p>
              <p className="rq-idea">{r.idea}</p>
              <dl className="rq-facts">
                {r.placement && (
                  <div>
                    <dt>Placement</dt>
                    <dd>{r.placement}</dd>
                  </div>
                )}
                {r.size && (
                  <div>
                    <dt>Size</dt>
                    <dd>{r.size}</dd>
                  </div>
                )}
                {r.availability && (
                  <div>
                    <dt>Free</dt>
                    <dd>{r.availability}</dd>
                  </div>
                )}
              </dl>
              {(r.photos || []).length > 0 && (
                <div className="rq-photos">
                  {r.photos.map((p) =>
                    urlOf[p] ? (
                      <a key={p} href={urlOf[p]} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={urlOf[p]} alt="Reference" loading="lazy" />
                      </a>
                    ) : null
                  )}
                </div>
              )}
              {r.pro_note && <p className="small-text muted">Your note: {r.pro_note}</p>}
              {r.status === "new" && <RequestActions id={r.id} services={services || []} serviceId={r.service_id} />}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
