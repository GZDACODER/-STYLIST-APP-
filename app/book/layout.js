import { Cormorant_Garamond } from "next/font/google";
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
      <div className="bk-bar">
        <span className="bk-bar-label">Appointments</span>
        <span className="bk-bar-label">Online booking</span>
      </div>
      <main className="bk-main">{children}</main>
      <footer className="bk-foot">
        <span className="bk-bar-label">Booking by</span>
        {/* The app's cursive wordmark, used as a signature. */}
        <span className="bk-signature">{BRAND_NAME}</span>
      </footer>
    </div>
  );
}
