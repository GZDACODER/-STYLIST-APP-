"use client";

// Apple Pay / Google Pay right on the payment page (Stripe's Express
// Checkout Element). Shows nothing when the phone or browser has no wallet,
// or before the publishable key is set: "Pay with card" is always there.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { finishWalletPayment, startWalletPayment } from "./walletActions";

const KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

function loadStripeJs() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.Stripe) return Promise.resolve(window.Stripe);
  return new Promise((resolve, reject) => {
    let script = document.querySelector('script[src="https://js.stripe.com/v3/"]');
    if (!script) {
      script = document.createElement("script");
      script.src = "https://js.stripe.com/v3/";
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", () => (window.Stripe ? resolve(window.Stripe) : reject(new Error("no Stripe"))));
    script.addEventListener("error", () => reject(new Error("Stripe didn't load")));
  });
}

const PROBLEM = {
  no_payouts: "This business can't take online payments yet.",
  cancelled: "This payment link was cancelled.",
  paid: "This has already been paid.",
};

export default function WalletPay({ token, amountCents }) {
  const box = useRef(null);
  const router = useRouter();
  const [shown, setShown] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!KEY) return undefined;
    let element;
    let cancelled = false;
    loadStripeJs()
      .then((StripeCtor) => {
        if (cancelled || !box.current) return;
        const stripe = StripeCtor(KEY);
        const elements = stripe.elements({
          mode: "payment",
          amount: amountCents,
          currency: "usd",
          appearance: { theme: "stripe", variables: { borderRadius: "12px", fontFamily: "Inter, system-ui, sans-serif" } },
        });
        element = elements.create("expressCheckout", {
          buttonHeight: 50,
          buttonType: { applePay: "plain", googlePay: "plain" },
          paymentMethods: { applePay: "always", googlePay: "always", link: "never", amazonPay: "never", paypal: "never", klarna: "never" },
          layout: { maxColumns: 1, overflow: "never" },
        });
        element.on("ready", ({ availablePaymentMethods }) => {
          const any = Boolean(availablePaymentMethods && Object.values(availablePaymentMethods).some(Boolean));
          setShown(any);
        });
        element.on("confirm", async () => {
          setError("");
          setBusy(true);
          const { error: submitError } = await elements.submit();
          if (submitError) {
            setBusy(false);
            setError(submitError.message || "That didn't go through.");
            return;
          }
          const started = await startWalletPayment(token);
          if (!started?.clientSecret) {
            element.paymentFailed?.();
            setBusy(false);
            setError(PROBLEM[started?.error] || "Payment couldn't start. Try Pay with card below.");
            return;
          }
          const { error: payError, paymentIntent } = await stripe.confirmPayment({
            elements,
            clientSecret: started.clientSecret,
            confirmParams: { return_url: `${window.location.origin}/pay/${token}` },
            redirect: "if_required",
          });
          if (payError) {
            setBusy(false);
            setError(payError.message || "That payment didn't go through. Try again or pay with card.");
            return;
          }
          if (paymentIntent?.id) await finishWalletPayment(token, paymentIntent.id);
          router.refresh();
        });
        element.mount(box.current);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      element?.destroy?.();
    };
  }, [token, amountCents, router]);

  if (!KEY) return null;
  return (
    <div className={`py-wallet-wrap${shown ? " is-shown" : ""}`}>
      {/* Mounted out of sight until Stripe says a wallet is ready. */}
      <div ref={box} className="py-wallet" aria-busy={busy} />
      {error && <p className="message error">{error}</p>}
      {shown && <p className="py-or">or</p>}
    </div>
  );
}
