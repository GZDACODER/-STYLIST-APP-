import { Cormorant_Garamond } from "next/font/google";
import "./home.css";

// The marketing homepage at clientelesuite.com: the booking pages' editorial
// look (ivory paper, warm black ink, Cormorant headings, champagne gold).
const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
});

export const viewport = { themeColor: "#F5F1EA" };

export default function HomeLayout({ children }) {
  return <div className={`hm ${display.variable}`}>{children}</div>;
}
