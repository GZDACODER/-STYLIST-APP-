"use client";

// Settings → Support: "Let Clientele support help me". While it's on, the
// owner can open the pro's whole dashboard for up to an hour; every change
// is listed under "What support has done".
import { useActionState } from "react";
import { endHelp, startHelp } from "./helpActions";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";

export default function HelpModeCard({ openUntil }) {
  const [startState, start] = useActionState(startHelp, null);
  const [endState, end] = useActionState(endHelp, null);
  return (
    <section className="card help-card">
      <h2>Live help</h2>
      {openUntil ? (
        <>
          <p className="message success">
            <strong>Help mode is on until {openUntil}.</strong> Clientele support can open your dashboard and fix things
            with you. Every change is listed below.
          </p>
          <form action={end}>
            <SubmitButton className="button secondary" pendingText="Ending...">
              End help now
            </SubmitButton>
          </form>
          <FormMessage state={endState} />
        </>
      ) : (
        <>
          <p>
            Stuck, or want us to set something up for you? Turn on help mode and Clientele support can open your
            dashboard for one hour, exactly as you see it, and fix things while you watch or carry on with your day.
          </p>
          <ul className="help-points">
            <li>Every change is listed below and emailed to you when we&apos;re done.</li>
            <li>We can&apos;t touch your billing, payouts, exports or login.</li>
            <li>End it any time, here or from the banner at the top of your dashboard.</li>
          </ul>
          <form action={start}>
            <SubmitButton className="button" pendingText="Turning on...">
              Let Clientele support help me (1 hour)
            </SubmitButton>
          </form>
          <FormMessage state={startState} />
        </>
      )}
    </section>
  );
}
