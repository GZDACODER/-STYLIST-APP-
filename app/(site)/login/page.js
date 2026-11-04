import Link from "next/link";
import LoginForm from "./LoginForm";
import { BRAND_NAME } from "@/lib/brand";

export const metadata = { title: `Log in · ${BRAND_NAME}` };

export default async function LoginPage({ searchParams }) {
  const { error } = await searchParams;

  return (
    <>
      <h1>Log in</h1>
      {error === "confirm" && (
        // The link confirms the email first. Finishing the log-in only works in
        // the browser that signed up, so on another phone or browser this shows,
        // but the account is confirmed and logging in works.
        <p className="message info">
          Your email is confirmed. Please log in below to finish. If logging in
          doesn&apos;t work, the link may have expired: sign up again to get a new one.
        </p>
      )}
      <div className="card">
        <LoginForm />
      </div>
      <p>
        New here? <Link href="/signup">Create an account</Link>
      </p>
    </>
  );
}
