import { Cormorant_Garamond } from "next/font/google";
import Logo from "@/components/Logo";
import "./auth.css";

const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-display",
});

export const viewport = { themeColor: "#12100D" };

// Log in, sign up and password pages: a black name plate framed in gold
// beside a sheet of paper with the form, like the dashboard they lead to.
export default function SiteLayout({ children }) {
  return (
    <div className={`au ${display.variable}`}>
      <aside className="au-plate">
        <div className="au-frame">
          <Logo />
          <p className="au-tag">The appointment book for beauty pros</p>
          <ol className="au-list">
            <li>
              <span>01</span>Online booking and deposits
            </li>
            <li>
              <span>02</span>Regulars, openings and a waitlist
            </li>
            <li>
              <span>03</span>Every client, remembered
            </li>
          </ol>
        </div>
      </aside>
      <main className="au-main">
        <div className="au-sheet">{children}</div>
      </main>
    </div>
  );
}
