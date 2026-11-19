// My Pros (/my: every pro a client books with, in one place) is hidden unless
// MY_PROS_ENABLED=true is set in Vercel. Clients sign in per pro instead, with
// the pro's ID code and their phone number (/client).
export function myProsEnabled() {
  return String(process.env.MY_PROS_ENABLED || "").trim().toLowerCase() === "true";
}
