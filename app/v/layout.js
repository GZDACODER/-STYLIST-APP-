import { Cormorant_Garamond } from "next/font/google";
import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";
import "../book/book.css";

// "Manage my appointment" pages (/v/<code>): the booking pages' look, phone first.
const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
});

export const viewport = { themeColor: "#F5F1EA" };
export const metadata = { title: `Your appointment · ${BRAND_NAME}`, robots: { index: false, follow: false } };

export default function ManageLayout({ children }) {
  return (
    <div className={`bk ${display.variable}`}>
      <div className="bk-bar">
        <span className="bk-bar-name">Your appointment</span>
      </div>
      <main className="bk-main cl-main">{children}</main>
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
