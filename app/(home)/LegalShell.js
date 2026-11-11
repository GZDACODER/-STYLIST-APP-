// The frame for the Terms and Privacy pages: the homepage's thin top bar
// and footer, around a readable column of text.
import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";
import { CONTACT_EMAIL, LEGAL_UPDATED } from "@/lib/legal";

export default function LegalShell({ title, children }) {
  return (
    <>
      <header className="hm-nav">
        <div className="hm-nav-inner">
          <Link href="/" className="hm-logo" aria-label={`${BRAND_NAME} home`}>
            {BRAND_NAME}
          </Link>
          <nav className="hm-nav-links" aria-label="Main">
            <Link href="/login">Log in</Link>
            <Link href="/signup" className="hm-button hm-button-small">
              Start free trial
            </Link>
          </nav>
        </div>
      </header>

      <main className="hm-legal">
        <p className="hm-kicker">Last updated {LEGAL_UPDATED}</p>
        <h1>{title}</h1>
        {children}
      </main>

      <footer className="hm-footer">
        <span className="hm-logo hm-logo-small">{BRAND_NAME}</span>
        <nav aria-label="Footer">
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <a href={`mailto:${CONTACT_EMAIL}`}>Contact · {CONTACT_EMAIL}</a>
        </nav>
        <p>© {new Date().getFullYear()} {BRAND_NAME}</p>
      </footer>
    </>
  );
}
