// Gift cards (step 65 SQL). Bought on the pro's booking page and paid to the
// pro's own Stripe account (like deposits, with the same Clientele fee);
// redeemed by the pro with the code. Server only.
import { randomInt } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, depositFeeCents } from "@/lib/stripe";
import { stylistEmails } from "@/lib/waitlist";
import { emailButton, emailConfigured, emailLayout, escapeHtml, sendEmails } from "@/lib/notify";
import { formatPrice } from "@/lib/money";
import { publicSiteUrl } from "@/lib/siteUrl";

export const GIFT_AMOUNTS = [2500, 5000, 7500, 10000, 15000];
export const GIFT_MIN = 1000;
export const GIFT_MAX = 100000;
const LETTERS = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const part = () => Array.from({ length: 4 }, () => LETTERS[randomInt(LETTERS.length)]).join("");
export const newGiftCode = () => `GIFT-${part()}-${part()}`;
export const cleanGiftCode = (t) => {
  const x = String(t || "").toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/^GIFT/, "");
  return x.length === 8 ? `GIFT-${x.slice(0, 4)}-${x.slice(4)}` : null;
};

/** Creates a pending card and a Stripe payment page; returns its URL. */
export async function createGiftCheckout({ stylist, amountCents, buyerName, buyerEmail, recipientName, recipientEmail, message, origin }) {
  const admin = createAdminClient();
  let card = null;
  for (let i = 0; i < 5 && !card; i += 1) {
    const { data, error } = await admin
      .from("gift_cards")
      .insert({
        stylist_id: stylist.id,
        code: newGiftCode(),
        amount_cents: amountCents,
        balance_cents: amountCents,
        buyer_name: buyerName,
        buyer_email: buyerEmail,
        recipient_name: recipientName,
        recipient_email: recipientEmail || null,
        message: message || null,
      })
      .select("id")
      .single();
    if (!error) card = data;
    else if (!/duplicate|unique/i.test(error.message)) throw error;
  }
  if (!card) throw new Error("Couldn't make a gift card code.");
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: amountCents,
          product_data: { name: `Gift card: ${stylist.business_name}`, description: `For ${recipientName}` },
        },
      },
    ],
    customer_email: buyerEmail,
    client_reference_id: card.id,
    metadata: { gift_card_id: card.id },
    payment_intent_data: {
      description: `Gift card for ${recipientName}`,
      metadata: { gift_card_id: card.id },
      transfer_data: { destination: stylist.stripe_account_id },
      application_fee_amount: depositFeeCents(amountCents),
    },
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    success_url: `${origin}/book/${stylist.slug}/gift/thanks?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/book/${stylist.slug}/gift?cancelled=1`,
  });
  await admin.from("gift_cards").update({ checkout_session_id: session.id }).eq("id", card.id);
  return session.url;
}

/**
 * Stripe says the gift card was paid: switch it on and send the emails.
 * Safe to run more than once (only the first run sends anything).
 * Returns 'active', 'already', 'unpaid' or 'not_found'.
 */
export async function finalizeGiftSession(session) {
  const id = session.metadata?.gift_card_id;
  if (!id) return "not_found";
  if (session.payment_status !== "paid") return "unpaid";
  const admin = createAdminClient();
  const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || null;
  const { data: rows } = await admin
    .from("gift_cards")
    .update({ status: "active", paid_at: new Date().toISOString(), payment_intent_id: pi })
    .eq("id", id)
    .eq("status", "pending")
    .select("*, stylist:stylists(id, slug, business_name, reply_email)");
  const g = rows?.[0];
  if (!g) return "already";
  if (emailConfigured()) {
    const site = publicSiteUrl("https://www.clientelesuite.com");
    const s = g.stylist;
    const book = `${site}/book/${s.slug}`;
    const amount = formatPrice(g.amount_cents);
    const card = [
      `<div style="margin:18px 0;padding:22px;background:#0e0d0b;color:#f5f1ea;text-align:center;">`,
      `<p style="margin:0;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#c8a96a;">Gift card</p>`,
      `<p style="margin:8px 0;font-size:34px;">${escapeHtml(amount)}</p>`,
      `<p style="margin:0;font-size:14px;">${escapeHtml(s.business_name)}</p>`,
      `<p style="margin:14px 0 0;font-size:20px;letter-spacing:3px;font-weight:600;">${escapeHtml(g.code)}</p>`,
      `</div>`,
    ].join("");
    const to = g.recipient_email || g.buyer_email;
    const proEmail = (await stylistEmails(admin, [s.id]))[s.id];
    const messages = [
      {
        to,
        subject: `${g.buyer_name} sent you a ${amount} gift card for ${s.business_name}`,
        ...(s.reply_email ? { replyTo: s.reply_email } : {}),
        html: emailLayout("You've got a gift card", [
          `<p>Hi ${escapeHtml(g.recipient_name)},</p>`,
          `<p>${escapeHtml(g.buyer_name)} sent you a gift card for ${escapeHtml(s.business_name)}.</p>`,
          g.message ? `<p style="margin:18px 0;padding:14px 16px;background:#f3eee5;border-left:3px solid #a8874d;white-space:pre-line;">${escapeHtml(g.message)}</p>` : "",
          card,
          `<p>Book a visit, then show or tell them this code when you pay.</p>`,
          `<p>${emailButton(book, "Book a visit")}</p>`,
        ]),
        text: `${g.buyer_name} sent you a ${amount} gift card for ${s.business_name}.${g.message ? `\n\n${g.message}` : ""}\n\nYour code: ${g.code}\nBook: ${book}\nShow or tell them the code when you pay.`,
      },
    ];
    if (g.recipient_email && g.recipient_email.toLowerCase() !== g.buyer_email.toLowerCase()) {
      messages.push({
        to: g.buyer_email,
        subject: `Your gift card for ${g.recipient_name} is on its way`,
        html: emailLayout("Thank you", [
          `<p>Your ${escapeHtml(amount)} gift card for ${escapeHtml(s.business_name)} has been emailed to ${escapeHtml(g.recipient_name)}.</p>`,
          `<p style="color:#6b665c;font-size:13px;">Code ${escapeHtml(g.code)}, in case they need it.</p>`,
        ]),
        text: `Your ${amount} gift card for ${s.business_name} has been emailed to ${g.recipient_name}. Code ${g.code}, in case they need it.`,
      });
    }
    if (proEmail) {
      messages.push({
        to: proEmail,
        subject: `You sold a ${amount} gift card`,
        html: emailLayout("Gift card sold", [
          `<p><strong>${escapeHtml(g.buyer_name)}</strong> bought a ${escapeHtml(amount)} gift card for <strong>${escapeHtml(g.recipient_name)}</strong>. The money goes to your Stripe account.</p>`,
          `<p>When they come in, redeem the code in Gift cards.</p>`,
          `<p>${emailButton(`${site}/dashboard/gift-cards`, "Open Gift cards")}</p>`,
        ]),
        text: `${g.buyer_name} bought a ${amount} gift card for ${g.recipient_name}. Redeem it in Gift cards: ${site}/dashboard/gift-cards`,
      });
    }
    await sendEmails(messages).catch(() => {});
  }
  return "active";
}
