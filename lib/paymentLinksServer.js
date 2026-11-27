// Payment links on the server (0080 SQL): the Stripe payment page for a
// link, and recording it once Stripe says it's paid. Paid like deposits and
// gift cards: straight to the pro's own Stripe account, minus Clientele's
// fee (lib/paymentLinks.js linkFeeCents). Server only.
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { stylistEmails } from "@/lib/waitlist";
import { todayInTimeZone } from "@/lib/availability";
import { emailButton, emailConfigured, emailLayout, escapeHtml, sendEmails } from "@/lib/notify";
import { publicSiteUrl } from "@/lib/siteUrl";
import { formatLinkAmount, linkFeeCents, linkPaymentKind } from "@/lib/paymentLinks";

const TOKEN = /^[A-Za-z0-9_-]{22,64}$/;

// The link and its pro, by token. null when there's no such link.
export async function loadPaymentLink(token) {
  if (!TOKEN.test(String(token || ""))) return null;
  const { data } = await createAdminClient()
    .from("payment_links")
    .select("id, token, stylist_id, booking_id, client_id, client_name, amount_cents, description, status, paid_at, stylist:stylists(business_name, slug, stripe_account_id, stripe_charges_enabled, timezone)")
    .eq("token", token)
    .maybeSingle();
  return data || null;
}

// A Stripe payment page for an open link; returns its URL.
export async function createPaymentLinkCheckout(token, origin) {
  const link = await loadPaymentLink(token);
  if (!link) throw new Error("not_found");
  if (link.status !== "open") throw new Error(link.status);
  const s = link.stylist;
  if (!s?.stripe_account_id || !s.stripe_charges_enabled) throw new Error("no_payouts");
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: link.amount_cents,
          product_data: { name: `${link.description}`, description: `Paid to ${s.business_name}` },
        },
      },
    ],
    client_reference_id: link.id,
    metadata: { payment_link_id: link.id },
    payment_intent_data: {
      description: `${s.business_name}: ${link.description}`,
      metadata: { payment_link_id: link.id },
      transfer_data: { destination: s.stripe_account_id },
      application_fee_amount: linkFeeCents(link.amount_cents),
    },
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    success_url: `${origin}/pay/${link.token}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/pay/${link.token}`,
  });
  await createAdminClient().from("payment_links").update({ checkout_session_id: session.id }).eq("id", link.id).eq("status", "open");
  return session.url;
}

/**
 * Stripe says a payment link was paid: mark it paid, record it in Money
 * (method "link"; a visit's balance as a balance payment) and email the pro.
 * Safe to run more than once: only the first run records or sends anything.
 * Returns 'paid', 'already', 'unpaid' or 'not_found'.
 */
export async function finalizePaymentLinkSession(session) {
  const id = session?.metadata?.payment_link_id;
  if (!id) return "not_found";
  if (session.payment_status !== "paid") return "unpaid";
  const admin = createAdminClient();
  const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || null;
  const email = session.customer_details?.email || null;
  // Paid even if the pro cancelled it meanwhile: the money arrived.
  const { data: rows } = await admin
    .from("payment_links")
    .update({ status: "paid", paid_at: new Date().toISOString(), payment_intent_id: pi, payer_email: email })
    .eq("id", id)
    .neq("status", "paid")
    .select("id, stylist_id, booking_id, client_id, client_name, amount_cents, description, stylist:stylists(business_name, timezone)");
  const link = rows?.[0];
  if (!link) return "already";

  await admin.from("payments").insert({
    stylist_id: link.stylist_id,
    booking_id: link.booking_id,
    client_id: link.client_id,
    client_name: link.client_name || session.customer_details?.name || null,
    kind: linkPaymentKind(link),
    method: "link",
    amount_cents: link.amount_cents,
    paid_on: todayInTimeZone(link.stylist?.timezone || "America/Chicago"),
    note: link.description.slice(0, 300),
  });

  if (emailConfigured()) {
    const to = (await stylistEmails(admin, [link.stylist_id]))[link.stylist_id];
    if (to) {
      const site = publicSiteUrl("https://www.clientelesuite.com");
      const amount = formatLinkAmount(link.amount_cents);
      const who = link.client_name || session.customer_details?.name || "A client";
      await sendEmails([
        {
          to,
          subject: `You got paid: ${amount} from ${who}`,
          html: emailLayout("You got paid", [
            `<p><strong>${escapeHtml(who)}</strong> paid <strong>${escapeHtml(amount)}</strong> for ${escapeHtml(link.description)}.</p>`,
            `<p>It goes to your Stripe account (minus the 3% + 30¢ fee) and is in Money as paid by link.</p>`,
            `<p>${emailButton(`${site}/dashboard/money?tab=links`, "Open Money")}</p>`,
          ]),
          text: `${who} paid ${amount} for ${link.description}. It's in Money as paid by link: ${site}/dashboard/money?tab=links`,
        },
      ]).catch(() => {});
    }
  }
  return "paid";
}
