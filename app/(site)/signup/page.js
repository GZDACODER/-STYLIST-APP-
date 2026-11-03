import Link from "next/link";
import SignupForm from "./SignupForm";
import { BRAND_NAME } from "@/lib/brand";

export const metadata = { title: `Sign up · ${BRAND_NAME}` };

export default function SignupPage() {
  return (
    <>
      <h1>Create your stylist account</h1>
      <p className="muted">It's free to start. You only pay for extras you turn on.</p>
      <div className="card">
        <SignupForm />
      </div>
      <p>
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </>
  );
}
