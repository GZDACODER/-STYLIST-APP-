import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";

// The app's cursive wordmark. size: "small" (header) or "large" (home page).
export default function Logo({ size = "small" }) {
  return (
    <Link href="/" className={`logo logo-${size}`} aria-label={`${BRAND_NAME} home`}>
      {BRAND_NAME}
    </Link>
  );
}
