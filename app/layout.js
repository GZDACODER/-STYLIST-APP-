import { Great_Vibes, Inter, Playfair_Display } from "next/font/google";
import Logo from "@/components/Logo";
import "./globals.css";

// Fonts are downloaded at build time and served with the site.
const script = Great_Vibes({ subsets: ["latin"], weight: "400", variable: "--font-script" });
const serif = Playfair_Display({ subsets: ["latin"], variable: "--font-serif" });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata = {
  title: "GZ Stylist App",
  description: "Luxury booking for hair stylists — regulars get first pick.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b0b0c",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${script.variable} ${serif.variable} ${sans.variable}`}>
      <body>
        <header className="site-header">
          <div className="site-header-inner">
            <Logo />
          </div>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
