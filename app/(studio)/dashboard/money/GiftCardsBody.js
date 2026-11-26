// The Gift cards tab on Money (step 65 SQL): sell them on your booking page
// (paid to your own Stripe account) and redeem them by code when the client pays.
import { getUser } from "@/lib/supabase/user";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/money";
import { publicSiteUrl } from "@/lib/siteUrl";
import AddPanel from "../shell/AddPanel";
import EmptyState from "@/components/dash/EmptyState";
import { GiftSwitch, RedeemForm } from "../gift-cards/GiftForms";
import { sample } from "@/lib/examples";
import { getMyTemplate } from "@/lib/templates/server";

const day = (iso) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const STATUS = { active: "Active", used: "Used up", void: "Not paid", pending: "Paying now" };

export default async function GiftCardsBody() {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) redirect("/login");
  const [{ data: s }, { data: cards, error }, { data: reds }] = await Promise.all([
    supabase.from("stylists").select("slug, gift_cards_on, stripe_account_id, stripe_charges_enabled").eq("id", user.id).maybeSingle(),
    supabase.from("gift_cards").select("id, code, amount_cents, balance_cents, buyer_name, recipient_name, status, paid_at, created_at").in("status", ["active", "used"]).order("paid_at", { ascending: false }).limit(500),
    supabase.from("gift_redemptions").select("gift_card_id, amount_cents, note, created_at").order("created_at", { ascending: false }).limit(1000),
  ]);
  const ready = Boolean(s?.stripe_account_id && s?.stripe_charges_enabled);
  const link = `${publicSiteUrl("https://www.clientelesuite.com")}/book/${s?.slug}/gift`;
  const all = cards || [];
  const outstanding = all.filter((c) => c.status === "active").reduce((a, c) => a + c.balance_cents, 0);
  const sold = all.reduce((a, c) => a + c.amount_cents, 0);
  const redsOf = {};
  for (const r of reds || []) (redsOf[r.gift_card_id] ||= []).push(r);

  return (
    <>
      {error && <p className="message error">Gift cards aren&apos;t set up yet (step 65 SQL).</p>}

      <section className="card">
        <div className="mn-tab-head">
          <h2>Selling</h2>
          <AddPanel id="redeem" label="Redeem a gift card" title="Redeem a gift card" className="button small secondary">
            <p className="muted small-text">When a client pays with a gift card, enter its code and how much to take off.</p>
            <RedeemForm notePlaceholder={sample(await getMyTemplate()).giftNote} />
          </AddPanel>
        </div>
        {!ready && (
          <p className="message info">
            Gift cards are paid to your own Stripe account. <Link href="/dashboard/settings/deposits">Connect Stripe</Link> first.
          </p>
        )}
        <p className="small-text">
          {s?.gift_cards_on ? "On. Clients can buy gift cards here:" : "Off. When it's on, clients buy gift cards here:"}{" "}
          <a href={link} target="_blank" rel="noreferrer">
            {link.replace(/^https?:\/\//, "")}
          </a>
        </p>
        <GiftSwitch on={Boolean(s?.gift_cards_on)} ready={ready} />
        <p className="muted small-text">
          Clientele&apos;s fee is the same as on deposits. Gift card sales aren&apos;t added to your Money totals: the visit counts when the card is used.
        </p>
      </section>


      <section className="card">
        <h2>Cards sold</h2>
        {all.length === 0 ? (
          <EmptyState icon="gift" title="No gift cards yet" text="Cards appear here once they're paid for." />
        ) : (
          <>
            <p className="muted small-text">
              {all.length} sold for {formatPrice(sold)} · {formatPrice(outstanding)} still to be used.
            </p>
            <ul className="rq-list">
              {all.map((c) => (
                <li key={c.id} className="mn-row">
                  <p className="rq-head">
                    <span>
                      {c.code} · for {c.recipient_name}
                    </span>
                    <strong>{formatPrice(c.balance_cents)} left</strong>
                  </p>
                  <p className="muted small-text">
                    {formatPrice(c.amount_cents)} from {c.buyer_name} · {c.paid_at ? day(c.paid_at) : ""} · {STATUS[c.status]}
                  </p>
                  {(redsOf[c.id] || []).map((r, i) => (
                    <p key={i} className="muted small-text">
                      − {formatPrice(r.amount_cents)} on {day(r.created_at)}
                      {r.note ? ` · ${r.note}` : ""}
                    </p>
                  ))}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </>
  );
}
