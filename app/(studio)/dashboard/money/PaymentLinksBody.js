// Money → Payment links: make a link for any amount, share it, and see
// which are open, paid or cancelled. Paid ones are also in Payments
// ("Paid by link").
import { createClient } from "@/lib/supabase/server";
import { formatLinkAmount, linkShareText } from "@/lib/paymentLinks";
import { publicSiteUrl } from "@/lib/siteUrl";
import SubmitButton from "@/components/SubmitButton";
import PaymentLinkForm from "./PaymentLinkForm";
import LinkShare from "./LinkShare";
import { cancelPaymentLink } from "./linkActions";

const STATUS = { open: "Waiting", paid: "Paid", cancelled: "Cancelled" };
const when = (iso) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default async function PaymentLinksBody({ stylist, example }) {
  const supabase = await createClient();
  const { data: links, error } = await supabase
    .from("payment_links")
    .select("id, token, client_name, amount_cents, description, status, created_at, paid_at")
    .order("created_at", { ascending: false })
    .limit(50);
  const site = publicSiteUrl("https://www.clientelesuite.com");
  const canTakePayments = Boolean(stylist?.stripe_account_id && stylist?.stripe_charges_enabled);

  return (
    <>
      <section className="card" id="new-link">
        <h2>New payment link</h2>
        <p className="muted small-text">
          Ask a client to pay for anything: a balance, a product, a touch-up. Share the link by text, Instagram or anywhere, and
          they pay in a minute.
        </p>
        <PaymentLinkForm canTakePayments={canTakePayments} example={example} />
      </section>

      <section className="card">
        <h2>Your payment links</h2>
        {error && <p className="message error">Couldn&apos;t load payment links.</p>}
        {!error && !(links || []).length ? (
          <p className="muted small-text">None yet. Links you make show here, and turn to Paid when the client pays.</p>
        ) : (
          <ul className="rq-list">
            {(links || []).map((l) => (
              <li key={l.id} className="mn-row">
                <p className="rq-head">
                  <span>
                    {l.description}
                    {l.client_name ? ` · ${l.client_name}` : ""}
                  </span>
                  <strong>{formatLinkAmount(l.amount_cents)}</strong>
                </p>
                <p className="muted small-text">
                  <span className={`pl-status is-${l.status}`}>{STATUS[l.status]}</span> · made {when(l.created_at)}
                  {l.paid_at ? ` · paid ${when(l.paid_at)}` : ""}
                </p>
                {l.status === "open" && (
                  <div className="row pl-row-actions">
                    <LinkShare url={`${site}/pay/${l.token}`} message={linkShareText(stylist?.business_name || "", l.amount_cents, l.description)} businessName={stylist?.business_name || ""} />
                    <form action={cancelPaymentLink}>
                      <input type="hidden" name="id" value={l.id} />
                      <SubmitButton className="link-button small-text" pendingText="Cancelling...">
                        Cancel link
                      </SubmitButton>
                    </form>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
