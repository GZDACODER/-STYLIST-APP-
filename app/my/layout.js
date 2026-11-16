import { Cormorant_Garamond } from "next/font/google";
import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";
import "../book/book.css";

// My Pros uses the booking pages' look (warm black on off-white paper).
const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
});

export const viewport = { themeColor: "#F5F1EA" };

export default function MyLayout({ children }) {
  return (
    <div className={`bk ${display.variable}`}>
      <div className="bk-bar">
        <span className="bk-bar-name">My Pros</span>
      </div>
      <main className="bk-main my-main">{children}</main>
      <footer className="bk-foot">
        <span className="bk-bar-label">Booking by</span>
        <span className="bk-signature">{BRAND_NAME}</span>
        <Link href="/privacy" className="bk-foot-privacy">
          Privacy
        </Link>
      </footer>
    </div>
  );
}
