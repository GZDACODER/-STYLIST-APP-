import { Cormorant_Garamond } from "next/font/google";
import "./home.css";

// The marketing homepage at clientelesuite.com: near-black, big serif type,
// gold (#B8975A) accents (Cormorant headings, Inter text, Great Vibes logo).
const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
});

export const viewport = { themeColor: "#0B0A09" };

export default function HomeLayout({ children }) {
  return <div className={`hm ${display.variable}`}>{children}</div>;
}
