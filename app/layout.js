import { Great_Vibes, Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { BRAND_NAME } from "@/lib/brand";

// Fonts are downloaded at build time and served with the site.
const script = Great_Vibes({ subsets: ["latin"], weight: "400", variable: "--font-script" });
const serif = Playfair_Display({ subsets: ["latin"], variable: "--font-serif" });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });

// The site's public address, so shared links and preview images use
// www.clientelesuite.com (NEXT_PUBLIC_SITE_URL in Vercel).
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.clientelesuite.com";
const DESCRIPTION =
  "Luxury booking that puts your regulars first. Deposits, waitlist and regulars-only times.";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: `${BRAND_NAME} — Booking for Hair Stylists`,
  description: DESCRIPTION,
  applicationName: BRAND_NAME,
  openGraph: {
    siteName: BRAND_NAME,
    type: "website",
    title: `${BRAND_NAME} — Booking for Hair Stylists`,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND_NAME} — Booking for Hair Stylists`,
    description: DESCRIPTION,
  },
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
