import { Cormorant_Garamond } from "next/font/google";
import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";
import "../book/book.css";
import "../p/profile.css";
import "./find.css";

// Find a pro (/find): the booking pages' editorial look.
const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
});

export const viewport = { themeColor: "#F5F1EA" };

export default function FindLayout({ children }) {
  return (
    <div className={`bk ${display.variable}`}>
      {children}
      <footer className="bk-foot">
        <span className="bk-bar-label">Search by</span>
        <span className="bk-signature">{BRAND_NAME}</span>
        <Link href="/privacy" className="bk-foot-privacy">
          Privacy
        </Link>
      </footer>
    </div>
  );
}
