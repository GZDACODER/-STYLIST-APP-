import { Cormorant_Garamond } from "next/font/google";
import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";
import "./book.css";

// The public booking pages have their own editorial look: warm black ink on
// off-white paper, thin rules instead of boxes, Cormorant Garamond headings,
// Inter text (from the main layout), and champagne gold used sparingly.
const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
});

export const viewport = { themeColor: "#F5F1EA" };

export default function BookLayout({ children }) {
  return (
    <div className={`bk ${display.variable}`}>
      {/* The top bar (the stylist's name and links) and <main> come from
          [slug]/layout.js, which knows whose page this is. */}
      {children}
      <footer className="bk-foot">
        <span className="bk-bar-label">Booking by</span>
        {/* The app's cursive wordmark, used as a signature. */}
        <span className="bk-signature">{BRAND_NAME}</span>
        {/* Clients' details are stored by Clientele for the business. */}
        <Link href="/privacy" className="bk-foot-privacy">
          Privacy
        </Link>
      </footer>
    </div>
  );
}
