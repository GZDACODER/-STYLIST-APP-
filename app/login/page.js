import Link from "next/link";
import LoginForm from "./LoginForm";

export const metadata = { title: "Log in · Regulars First" };

export default async function LoginPage({ searchParams }) {
  const { error } = await searchParams;

  return (
    <>
      <h1>Log in</h1>
      {error === "confirm" && (
        <p className="message error">
          That confirmation link didn't work or has expired. Try logging in, or
          sign up again.
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
