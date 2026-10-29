"use server";

// Server actions for the public booking page. The real rules (who sees which
// times, who can book) are enforced inside the database functions these call.
import { createBookingClient } from "@/lib/supabase/booking";
import { createDepositCheckout, siteOrigin, stripeTestMode } from "@/lib/stripe";
import { normalizePhone } from "@/lib/phone";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const BOOKING_ERRORS = {
  not_verified: "Please confirm your phone number first.",
  invalid_name: "Please enter your name.",
  invalid_phone: "Please enter a phone number we can reach you on.",
  invalid_email: "That email doesn't look right. You can also leave it empty.",
  blocked: "Sorry, online booking isn't available for you. Please contact the salon directly.",
  slot_unavailable: "Sorry, that time was just taken. Please pick another time.",
  too_many_bookings:
    "You already have 3 upcoming appointments here. Please contact the salon to book more.",
  not_found: "That service isn't available any more. Please refresh the page.",
};

// method is "phone" (a text message code) or "email".
// Returns { success, value } where value is the cleaned-up number or email.
export async function sendCode(method, value) {
  const supabase = await createBookingClient();

  if (method === "phone") {
    const phone = normalizePhone(value);
    if (!phone) return { error: "Please enter your mobile number, like (555) 123-4567." };

    const { error } = await supabase.auth.signInWithOtp({
      phone,
      options: { shouldCreateUser: true, channel: "sms" },
    });
    if (error) {
      console.error("Couldn't send text code", error.code, error.message);
      if (error.status === 429 || /rate limit|after \d+ seconds/i.test(error.message)) {
        return { error: "Too many codes requested. Please wait a minute and try again." };
      }
      // Twilio refused the text. Supabase passes on Twilio's reason, e.g.
      // "Error sending sms OTP to provider: The number +1555... is unverified".
      const sendFailed = error.code === "sms_send_failed" || /error sending .*otp/i.test(error.message);
      if (sendFailed) {
        const reason = error.message.replace(/^.*?to provider:\s*/i, "").trim();
        return {
          error: `We couldn't text that number. Check it and try again, or use email instead.${
            reason ? ` Details: ${reason}` : ""
          }`,
        };
      }
      // Phone codes are switched off (or not set up) in Supabase.
      if (
        error.code === "phone_provider_disabled" ||
        /unsupported phone provider|phone.*disabled/i.test(error.message)
      ) {
        return { error: "Text message codes aren't working right now. Please use email instead." };
      }
      return {
        error: `We couldn't send a text right now. Please try again, or use email instead. Details: ${error.message}`,
      };
    }
    return { success: true, value: phone };
  }

  const email = String(value || "").trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) return { error: "Please enter a valid email." };

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) {
    if (error.status === 429 || /rate limit|after \d+ seconds/i.test(error.message)) {
      return { error: "Too many codes requested. Please wait a minute and try again." };
    }
    return { error: "We couldn't send a code right now. Please try again shortly." };
  }
  return { success: true, value: email };
}

export async function verifyCode(method, value, code) {
  const cleanCode = String(code || "").replace(/\D/g, "");
  if (cleanCode.length < 6) {
    return {
      error:
        method === "phone" ? "Please enter the 6-digit code." : "Please enter the code from the email.",
    };
  }

  const supabase = await createBookingClient();
  const { error } =
    method === "phone"
      ? await supabase.auth.verifyOtp({
          phone: normalizePhone(value) || "",
          token: cleanCode,
          type: "sms",
        })
      : await supabase.auth.verifyOtp({
          email: String(value || "").trim().toLowerCase(),
          token: cleanCode,
          type: "email",
        });

  if (error) return { error: "That code didn't work or has expired. Check it, or send a new one." };
  return { success: true };
}

export async function signOutBooking() {
  const supabase = await createBookingClient();
  await supabase.auth.signOut({ scope: "local" });
  return { success: true };
}

export async function getSlots(slug, serviceId) {
  const supabase = await createBookingClient();
  const { data, error } = await supabase.rpc("get_open_slots", {
    p_slug: String(slug),
    p_service_id: String(serviceId),
  });
  if (error) return { error: "Couldn't load open times. Please refresh the page." };
  return { slots: data };
}

export async function book({ slug, serviceId, date, time, name, phone, email }) {
  const supabase = await createBookingClient();
  const { data, error } = await supabase.rpc("create_booking", {
    p_slug: String(slug),
    p_service_id: String(serviceId),
    p_date: String(date),
    p_time: String(time),
    p_name: String(name || ""),
    p_phone: String(phone || ""),
    p_email: String(email || ""),
  });

  if (error) {
    return {
      error: BOOKING_ERRORS[error.message] || "Something went wrong. Please try again.",
      code: error.message,
    };
  }

  // This service needs a deposit: the time is held while they pay on Stripe.
  if (data.status === "pending_payment") {
    try {
      return { checkoutUrl: await createDepositCheckout(data.id, await siteOrigin()) };
    } catch (e) {
      console.error("Couldn't start deposit payment", e);
      const message = "We couldn't open the payment page. Please try again in a moment.";
      // While testing, show the real reason so it can be fixed. Real
      // clients (live keys) never see technical details.
      const detail = e?.raw?.message || e?.message;
      return { error: stripeTestMode() && detail ? `${message} Details: ${detail}` : message };
    }
  }
  return { booking: data };
}
