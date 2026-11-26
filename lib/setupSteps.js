// The Home "Get set up" checklist. The first three steps are what a booking
// needs (a service, hours, and open times: times only come from Openings);
// sharing comes after them. bookable: a client could book right now.
export function setupSteps({ services = 0, hours = 0, openingsAhead = 0, stripe = false, cover = false, booked = false }) {
  const steps = [
    { key: "services", done: services > 0, text: "Add your services", href: "/dashboard/services" },
    { key: "hours", done: hours > 0, text: "Set your working hours", href: "/dashboard/availability" },
    { key: "openings", done: openingsAhead > 0, text: "Open times clients can book", href: "/dashboard/openings" },
    { key: "share", done: Boolean(booked), text: "Share your booking link (done after your first booking)", href: "/dashboard/share" },
    { key: "stripe", done: Boolean(stripe), text: "Connect Stripe for deposits", href: "/dashboard/settings/deposits" },
    { key: "cover", done: Boolean(cover), text: "Add a cover photo", href: "/dashboard/settings/booking-page" },
  ];
  return { steps, bookable: services > 0 && openingsAhead > 0, left: steps.filter((s) => !s.done).length };
}
