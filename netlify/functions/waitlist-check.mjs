// Runs every minute on Netlify: tells waitlisted clients about newly opened
// times, and tells everyone else once the regulars' head start is over.
// It just calls the app's /api/waitlist/run address, where the work happens.
// (Netlify only runs this on the live site, not on previews.)
export default async (request, context) => {
  const site = context?.site?.url || process.env.URL;
  const response = await fetch(`${site}/api/waitlist/run`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  if (!response.ok) {
    console.error("Waitlist check failed", response.status, await response.text());
  }
};

export const config = { schedule: "* * * * *" };
