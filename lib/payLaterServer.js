// Which "Pay over time" methods are switched on in Clientele's Stripe
// account (Dashboard → Settings → Payment methods). Checked at most every
// 10 minutes; nothing shows until one is on. Server only.
import { getStripe } from "@/lib/stripe";
import { PAY_LATER_TYPES, payLaterTypes } from "@/lib/payLater";

let cache = { at: 0, types: [] };

export async function payLaterAvailable() {
  if (Date.now() - cache.at < 10 * 60 * 1000) return cache.types;
  try {
    const { data } = await getStripe().paymentMethodConfigurations.list({ limit: 10 });
    const config = data.find((c) => c.is_default && c.active && !c.application) || data[0];
    const types = PAY_LATER_TYPES.filter((t) => config?.[t]?.available && config[t].display_preference?.value === "on");
    cache = { at: Date.now(), types };
  } catch (error) {
    console.error("Couldn't check pay-over-time methods", error?.message);
    cache = { at: Date.now(), types: cache.types };
  }
  return cache.types;
}

// The methods to offer for this amount, if the pro has it on.
export async function payLaterFor(stylist, amountCents) {
  if (!stylist?.pay_later_on) return [];
  return payLaterTypes(amountCents, await payLaterAvailable());
}
