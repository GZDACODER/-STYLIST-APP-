import { Cormorant_Garamond } from "next/font/google";
import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";
import "../pay/pay.css";

// Invite pages (/join/shop/[token]) in the same card look as payment pages.
const display = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-display" });

export const viewport = { themeColor: "#F4EFE6" };

export default function JoinLayout({ children }) {
  return (
    <div className={`py ${display.variable}`}>
      <main className="py-main">{children}</main>
      <footer className="py-foot">
        <span className="py-signature">{BRAND_NAME}</span>
        <span aria-hidden="true">·</span>
        <Link href="/privacy">Privacy</Link>
      </footer>
    </div>
  );
}
