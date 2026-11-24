import { Cormorant_Garamond } from "next/font/google";
import "./home.css";

// The marketing site at clientelesuite.com, in the app's look: warm cream
// with a gold gradient, frosted glass, Cormorant headings, Inter text,
// Great Vibes logo.
const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
});

export const viewport = { themeColor: "#F4EFE6" };

export default function HomeLayout({ children }) {
  return <div className={`hm ${display.variable}`}>{children}</div>;
}
