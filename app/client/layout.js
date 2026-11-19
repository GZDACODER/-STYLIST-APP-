import { Cormorant_Garamond } from "next/font/google";
import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";
import GuideProvider from "@/components/guide/GuideProvider";
import "../book/book.css";

// Client sign-in and the client home: the booking pages' look (warm black on
// off-white paper, champagne gold), iPhone first.
const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
});

export const viewport = { themeColor: "#F5F1EA" };
export const metadata = { title: `Your visits · ${BRAND_NAME}`, robots: { index: false } };

export default function ClientLayout({ children }) {
  return (
    <div className={`bk ${display.variable}`}>
      <div className="bk-bar">
        <span className="bk-bar-name">Your visits</span>
      </div>
      <GuideProvider mode="client" scope="client">
        <main className="bk-main cl-main">{children}</main>
      </GuideProvider>
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
