// Packages (step 68 SQL): prepaid bundles of sessions. Each session that
// goes ahead uses one automatically (oldest package first); a no-show or
// cancellation gives it back.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BRAND_NAME } from "@/lib/brand";
import { formatPrice } from "@/lib/money";
import { formatDate } from "@/lib/availability";
import { getMyTemplate } from "@/lib/templates/server";
import { METHOD_LABEL } from "@/lib/moneyTab";
import PageHeader from "@/components/dash/PageHeader";
import EmptyState from "@/components/dash/EmptyState";
import AddPanel from "../shell/AddPanel";
import SubmitButton from "@/components/SubmitButton";
import SellForm from "./SellForm";
import { voidPackage } from "./actions";

export const metadata = { title: `Packages · ${BRAND_NAME}` };

export default async function PackagesPage({ searchParams }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { show } = await searchParams;
  const past = show === "past";
  const tpl = await getMyTemplate();
  const [{ data: pkgs, error }, { data: clients }, { data: services }, { data: uses }] = await Promise.all([
    supabase.from("client_packages").select("*").order("created_at", { ascending: false }).limit(500),
    supabase.from("clients").select("id, name").order("name").limit(3000),
    supabase.from("services").select("id, name").order("name"),
    supabase.from("package_uses").select("client_package_id, booking:bookings(booking_date, service_name)").limit(5000),
  ]);
  const all = pkgs || [];
  const list = all.filter((p) => (past ? p.status !== "active" : p.status === "active"));
  const usesOf = {};
  for (const u of uses || []) (usesOf[u.client_package_id] ||= []).push(u.booking);
  const W = tpl.words;

  return (
    <>
      <PageHeader
        guide="packages"
        title="Packages"
        subtitle={`Prepaid bundles of ${W.appointments}. Each one that goes ahead is counted for you.`}
        actions={
          <AddPanel id="sell" label="+ Sell a package" title="Sell a package">
            <p className="muted small-text">
              Record a package they&apos;ve paid for (or will pay). From then on, each of their {W.appointments} that goes ahead uses one. A no-show or cancellation doesn&apos;t.
            </p>
            {(clients || []).length ? (
              <SellForm clients={clients} services={services || []} presets={tpl.presets.packages || []} words={W} />
            ) : (
              <p className="muted small-text">Add {W.aClient} first in {W.Clients}.</p>
            )}
          </AddPanel>
        }
      />
      {error && <p className="message error">Packages aren&apos;t set up yet (step 68 SQL).</p>}
      <nav className="cr-tabs" aria-label="Packages">
        <a href="/dashboard/packages" className={!past ? "cr-tab active" : "cr-tab"}>
          Active ({all.filter((p) => p.status === "active").length})
        </a>
        <a href="/dashboard/packages?show=past" className={past ? "cr-tab active" : "cr-tab"}>
          Used up or cancelled ({all.filter((p) => p.status !== "active").length})
        </a>
      </nav>
      {list.length === 0 ? (
        <EmptyState icon="gift" title={past ? "Nothing here yet" : "No active packages"} text={`Sell one, like 10 ${W.appointments} paid up front.`}
          action={
            past ? null : (
              <a href="#sell" className="button small">
                + Sell a package
              </a>
            )
          }
        />
      ) : (
        <ul className="rq-list">
          {list.map((p) => {
            const left = p.sessions_total - p.sessions_used;
            return (
              <li key={p.id} className="card">
                <p className="rq-head">
                  <span>
                    {p.client_name} · {p.name}
                  </span>
                  <strong>{p.status === "void" ? "Cancelled" : `${left} of ${p.sessions_total} left`}</strong>
                </p>
                <span className="pj-bar" aria-hidden="true">
                  <span style={{ width: `${(p.sessions_used / p.sessions_total) * 100}%` }} />
                </span>
                <p className="muted small-text">
                  Sold {formatDate(p.purchased_on)} for {formatPrice(p.price_cents)}
                  {p.paid_method ? ` · ${METHOD_LABEL[p.paid_method]}` : " · not paid yet"}
                  {p.expires_on ? ` · expires ${formatDate(p.expires_on)}` : ""}
                </p>
                {(usesOf[p.id] || []).length > 0 && (
                  <p className="muted small-text">
                    Used: {(usesOf[p.id] || []).map((b) => b && `${formatDate(b.booking_date).replace(/, \d{4}$/, "")}`).filter(Boolean).join(", ")}
                  </p>
                )}
                {p.status === "active" && (
                  <form action={voidPackage}>
                    <input type="hidden" name="id" value={p.id} />
                    <SubmitButton className="link-button small-text" pendingText="...">
                      Cancel package
                    </SubmitButton>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
