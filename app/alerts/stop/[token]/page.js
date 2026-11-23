// One tap from an alert email: stops opening alerts from that pro, with a
// way to undo.
import Link from "next/link";
import { unfollowByToken } from "@/lib/followers";
import Undo from "./Undo";

export const dynamic = "force-dynamic";

export default async function StopAlerts({ params }) {
  const { token } = await params;
  const r = await unfollowByToken(token);
  if (!r)
    return (
      <section className="card">
        <h1>This link doesn&apos;t work</h1>
        <p>It may be old. If you&apos;re still getting alerts, reply to one and we&apos;ll stop them.</p>
      </section>
    );
  return (
    <section className="card">
      <h1>You&apos;re unsubscribed</h1>
      <p>You won&apos;t get any more opening alerts from {r.name}.</p>
      <Undo token={token} />
      {r.handle && (
        <p className="small-text">
          <Link href={`/p/${r.handle}`}>Back to {r.name}</Link>
        </p>
      )}
    </section>
  );
}
