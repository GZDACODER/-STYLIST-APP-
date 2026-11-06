import { Cormorant_Garamond } from "next/font/google";
import "../dashboard/dashboard.css";

// The wrap-up email's link opens here: the dashboard's look, without the
// menu (and without logging in; see lib/visitPass.js).
const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
});

export const viewport = { themeColor: "#0E0E0E" };

export default function VisitsLayout({ children }) {
  return (
    <div className={`db db-solo ${display.variable}`}>
      <main className="db-main">
        <div className="db-page">{children}</div>
      </main>
    </div>
  );
}
