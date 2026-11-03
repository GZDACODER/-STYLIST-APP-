import { Great_Vibes, Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { BRAND_NAME } from "@/lib/brand";

// Fonts are downloaded at build time and served with the site.
const script = Great_Vibes({ subsets: ["latin"], weight: "400", variable: "--font-script" });
const serif = Playfair_Display({ subsets: ["latin"], variable: "--font-serif" });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata = {
  title: `${BRAND_NAME}`,
  description: "Luxury booking for hair stylists — regulars get first pick.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b0b0c",
};

// The header and page width live in the two layouts below this one:
// app/(site)/layout.js (home, log in, dashboard) and app/book/layout.js
// (the public booking pages, which have their own editorial look).
export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${script.variable} ${serif.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
