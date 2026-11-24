// Trial feedback questionnaire (prompted on Home during the trial; also
// linked from Settings → Plan & billing).
import { BRAND_NAME } from "@/lib/brand";
import PageHeader from "@/components/dash/PageHeader";
import FeedbackForm from "./FeedbackForm";

export const metadata = { title: `Feedback · ${BRAND_NAME}` };

export default function FeedbackPage() {
  return (
    <>
      <PageHeader
        guide="feedback"
        title="How's it going?"
        subtitle="Five quick questions about your trial. It takes about two minutes, and your answers go straight to the people building Clientele."
      />
      <section className="card">
        <FeedbackForm />
      </section>
    </>
  );
}
