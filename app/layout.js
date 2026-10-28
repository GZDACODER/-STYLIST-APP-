import "./globals.css";

export const metadata = {
  title: "Regulars First",
  description: "Booking for hair stylists — regulars get first pick.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
