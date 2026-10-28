import Link from "next/link";

export default function NotFound() {
  return (
    <div className="stack">
      <h1>Page not found</h1>
      <p className="muted">
        If you&apos;re trying to book, check the link your stylist sent you.
      </p>
      <Link href="/" className="button secondary">
        Go to the home page
      </Link>
    </div>
  );
}
