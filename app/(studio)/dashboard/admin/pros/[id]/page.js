// Admin > Pros > one pro: everything about their account and the owner's
// actions on it (ProActions.js), with a record of what was done.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/user";
import { isAdmin } from "@/lib/admin";
import { BRAND_NAME } from "@/lib/brand";
import { STAGES } from "@/lib/activation";
import PageHeader from "@/components/dash/PageHeader";
import { loadProAdmin } from "../data";
import { siteBase } from "../../launch/data";
import ProActions from "./ProActions";

export const metadata = { title: `Pro (admin) · ${BRAND_NAME}` };

const date = (iso) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "never");
const money = (c) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: c % 100 ? 2 : 0 })}`;

export default async function ProAdminPage({ params }) {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!isAdmin(user)) notFound();
  const { id } = await params;
  const { pro: p, error } = await loadProAdmin(id);
  if (!p) notFound();
  const link = `${siteBase()}/book/${p.slug}`;
  const facts = [
    ["Owner", [p.firstName, p.email].filter(Boolean).join(" · ") || "—"],
    ["Trade", p.trade || "Not picked"],
    ["Signed up", date(p.createdAt)],
    ["Last login", date(p.lastSignInAt)],
    ["Plan", p.status.label],
    ["Payouts (Stripe)", p.payouts === "on" ? "On, deposits work" : p.payouts === "started" ? "Started, not finished" : "Not connected"],
    ["Setup", `${STAGES[p.step].label}${p.stuck ? ` · stuck ${p.daysStuck} days` : ""}`],
    ["Services", String(p.services)],
    ["Open times ahead", String(p.openingsAhead)],
    ["Bookings", `${p.stats.total} total · ${p.stats.upcoming} upcoming · ${p.stats.cancelled} cancelled`],
    ["Deposits paid", money(p.stats.depositsCents)],
  ];

  return (
    <>
      <p className="small-text">
        <Link href="/dashboard/admin/pros">← All pros</Link>
      </p>
      <PageHeader
        guide="admin_pro"
        eyebrow="Admin · Pro"
        title={p.businessName}
        subtitle={[p.paused && "Paused", p.founding && "Founding pro", p.you ? "Your own account" : p.test && "Test or demo account"].filter(Boolean).join(" · ") || undefined}
        actions={
          <a href={link} target="_blank" rel="noreferrer" className="button small secondary">
            Booking page
          </a>
        }
      />
      {error && <p className="message error">Couldn&apos;t load everything: {error.message}</p>}

      <div className="ap-cols">
        <section className="card">
          <h2>Account</h2>
          <dl className="ap-facts">
            {facts.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <p className="muted small-text">
            To see inside their dashboard they need to turn on Support access (Settings → Support). Then they show in{" "}
            <Link href="/dashboard/admin/control/support">Control Room → Support</Link>.
          </p>
        </section>

        <ProActions
          id={p.id}
          paying={p.status.key === "paying"}
          free={Boolean(p.plan?.comped)}
          founding={p.founding}
          firstName={p.firstName}
          email={p.email}
          paused={p.paused}
          pausedReason={p.pausedReason}
        />
      </div>

      <section className="card">
        <h2>History</h2>
        {p.log.length === 0 && p.nudges.length === 0 ? (
          <p className="muted">Nothing yet. Changes you make and emails you send show here.</p>
        ) : (
          <ul className="ap-log">
            {[
              ...p.log.map((l) => ({ at: l.created_at, text: l.detail || l.action, by: l.admin_email })),
              ...p.nudges.map((n) => ({ at: n.sent_at, text: `Launch week note: "${n.subject}"`, by: "" })),
            ]
              .sort((a, b) => b.at.localeCompare(a.at))
              .map((e, i) => (
                <li key={i}>
                  <span className="ap-log-when">{date(e.at)}</span> {e.text}
                </li>
              ))}
          </ul>
        )}
      </section>
    </>
  );
}
