import Link from "next/link";

// "GZ Stylist App" in gold script. size: "small" (header) or "large" (home page).
export default function Logo({ size = "small" }) {
  return (
    <Link href="/" className={`logo logo-${size}`} aria-label="GZ Stylist App home">
      GZ Stylist App
    </Link>
  );
}
