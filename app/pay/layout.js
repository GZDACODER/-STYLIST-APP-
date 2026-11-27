import { Cormorant_Garamond } from "next/font/google";
import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";
import "./pay.css";

// Payment links (/pay/[token]) in the app's look, the same as the homepage
// and dashboard: warm cream with a gold glow, one frosted card, Cormorant
// for the amount, Inter text, the Great Vibes wordmark.
const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-display",
});

export const viewport = { themeColor: "#F4EFE6" };

export default function PayLayout({ children }) {
  return (
    <div className={`py ${display.variable}`}>
      <main className="py-main">{children}</main>
      <footer className="py-foot">
        <span>Payments by Stripe</span>
        <span aria-hidden="true">·</span>
        <span className="py-signature">{BRAND_NAME}</span>
        <span aria-hidden="true">·</span>
        <Link href="/privacy">Privacy</Link>
      </footer>
    </div>
  );
}
