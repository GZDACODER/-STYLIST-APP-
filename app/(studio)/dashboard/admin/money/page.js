// Admin > Money: Clientele's own money, straight from Stripe. What's in the
// balance, what's on the way to the bank, deposit fees (3% + 30¢) and
// subscriptions this month against last, and monthly recurring revenue.
// Owner only (ADMIN_EMAILS). Numbers boiled down in lib/adminMoney.js.
import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/user";
import { isAdmin } from "@/lib/admin";
import { BRAND_NAME } from "@/lib/brand";
import { getStripe } from "@/lib/stripe";
import { moneySummary } from "@/lib/adminMoney";
import PageHeader from "@/components/dash/PageHeader";

export const metadata = { title: `Money (admin) · ${BRAND_NAME}` };
export const dynamic = "force-dynamic";

const usd = (c) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (sec) => new Date(sec * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" });
const PAYOUT = { paid: "In your bank", in_transit: "On the way", pending: "On the way", failed: "Failed", canceled: "Cancelled" };

async function loadStripe() {
  const stripe = getStripe();
  const now = new Date();
  const lastStart = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1) / 1000);
  const [balance, fees, invoices, subscriptions, payouts] = await Promise.all([
    stripe.balance.retrieve(),
    stripe.applicationFees.list({ created: { gte: lastStart }, limit: 100 }).autoPagingToArray({ limit: 2000 }),
    stripe.invoices.list({ status: "paid", created: { gte: lastStart }, limit: 100 }).autoPagingToArray({ limit: 2000 }),
    stripe.subscriptions.list({ status: "all", limit: 100 }).autoPagingToArray({ limit: 2000 }),
    stripe.payouts.list({ limit: 8 }),
  ]);
  return { balance, fees, invoices, subscriptions, payouts: payouts.data };
}

export default async function AdminMoneyPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!isAdmin(user)) notFound();

  let data = null;
  let error = null;
  try {
    data = await loadStripe();
  } catch (e) {
    error = e.message;
  }
  const key = String(process.env.STRIPE_SECRET_KEY || "").trim();
  const live = key.startsWith("sk_live") || key.startsWith("rk_live");
  const s = moneySummary(data || {});
  const tiles = [
    ["This month", usd(s.thisMonthCents), `Last month ${usd(s.lastMonthCents)}`],
    ["Monthly recurring", usd(s.mrrCents), `${s.payingCount} paying ${s.payingCount === 1 ? "pro" : "pros"} (yearly ÷ 12)`],
    ["Ready to pay out", usd(s.availableCents), `${usd(s.pendingCents)} still settling (about 2 days)`],
    ["On the way to your bank", usd(s.onTheWayCents), "Payouts sent, not landed yet"],
  ];

  return (
    <>
      <PageHeader
        guide="admin_money"
        eyebrow="Admin"
        title="Money"
        subtitle={`Clientele's own money, live from Stripe${live ? "" : " (TEST MODE: these aren't real payments)"}.`}
        actions={
          <a href="https://dashboard.stripe.com" target="_blank" rel="noreferrer" className="button small secondary">
            Open Stripe
          </a>
        }
      />
      {error && <p className="message error">Couldn&apos;t reach Stripe: {error}</p>}

      <section className="am-tiles" aria-label="Totals">
        {tiles.map(([k, v, sub]) => (
          <div key={k} className="card am-tile">
            <p className="am-k">{k}</p>
            <p className="am-v">{v}</p>
            <p className="muted small-text">{sub}</p>
          </div>
        ))}
      </section>

      <div className="ap-cols">
        <section className="card">
          <h2>Where it comes from</h2>
          <dl className="ap-facts">
            <div>
              <dt>Subscriptions</dt>
              <dd>
                {usd(s.subsThisMonthCents)} this month · {usd(s.subsLastMonthCents)} last month
              </dd>
            </div>
            <div>
              <dt>Deposit fees</dt>
              <dd>
                {usd(s.feesThisMonthCents)} this month · {usd(s.feesLastMonthCents)} last month
              </dd>
            </div>
          </dl>
          <p className="muted small-text">
            Deposit fees are the 3% + 30¢ Clientele keeps on each client deposit (after refunds). Stripe&apos;s own card fees come out of these before payout.
          </p>
        </section>

        <section className="card">
          <h2>Payouts</h2>
          {!data?.payouts?.length ? (
            <p className="muted">No payouts yet. Stripe sends your balance to your bank automatically once it&apos;s ready.</p>
          ) : (
            <ul className="ap-log">
              {data.payouts.map((p) => (
                <li key={p.id}>
                  <span className="ap-log-when">{day(p.arrival_date)}</span> {usd(p.amount)} · {PAYOUT[p.status] || p.status}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
