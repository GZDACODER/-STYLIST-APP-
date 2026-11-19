// The pro's ID code (step 45 SQL), with a Copy button. Clients sign in with
// it and their phone number at /client.
import CopyLinkButton from "./CopyLinkButton";

export default function ProCode({ code, compact = false }) {
  if (!code) return null;
  if (compact) {
    return (
      <p className="pro-code-line muted small-text">
        Your Pro ID <strong className="pro-code">{code}</strong>
        <CopyLinkButton link={code} label="Copy" className="link-button small-text" />
      </p>
    );
  }
  return (
    <div className="pro-code-card">
      <span className="db-label">Your Pro ID</span>
      <strong className="pro-code pro-code-big">{code}</strong>
      <p className="muted small-text">
        Clients sign in at clientelesuite.com/client with this ID and their phone number to see their visits, book
        their usual, move a visit or say they&apos;re running late. It&apos;s in their booking emails too.
      </p>
      <CopyLinkButton link={code} label="Copy ID" />
    </div>
  );
}
