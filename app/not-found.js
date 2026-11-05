import Link from "next/link";

export default function NotFound() {
  return (
    <main className="container stack">
      <h1>Page not found</h1>
      <p className="muted">
        If you&apos;re trying to book, check the link the business sent you.
      </p>
      <Link href="/" className="button secondary">
        Go to the home page
      </Link>
    </main>
  );
}
