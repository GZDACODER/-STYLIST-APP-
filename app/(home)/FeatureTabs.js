"use client";

// Homepage feature explorer: one tab at a time instead of a long scroll.
// Each tab has a short pitch, three points and a real screenshot of the
// redesigned page: the dashboard in a frosted window, public pages in a phone.
import { useEffect, useRef, useState } from "react";
import { DeskShot, PhoneShot } from "./Shots";

// The six parts of the suite. Each: a short pitch, three points and a small
// real screenshot of Clientele from the live demo.
const TABS = [
  {
    key: "booking",
    shot: "booking",
    alt: "A Clientele booking page on a phone: a service picked, the day and open times",
    label: "Booking",
    title: "A booking page that looks like you.",
    text: "Your name, your work and your prices. Clients book, pay a deposit and manage their visit from one link. No app to download.",
    points: [
      "Deposits by card, Apple Pay or Google Pay, straight to your Stripe.",
      "A waitlist that fills cancellations for you.",
      "Booking rules: notice, breaks, start times, a daily limit.",
    ],
  },
  {
    key: "regulars",
    shot: "dash-today",
    desk: true,
    phoneShot: "dash-today-phone",
    alt: "Today in Clientele: the date, appointments with Regular badges and deposits paid, next up and open times",
    label: "Regulars first",
    title: "Your best clients never fight for a spot.",
    text: "The clients who keep your book full get first pick of your time. Everyone else books what's left.",
    points: [
      "Regulars-only times nobody else sees.",
      "Standing appointments held months ahead.",
      "New openings go to regulars first.",
    ],
  },
  {
    key: "money",
    shot: "dash-money",
    desk: true,
    phoneShot: "dash-money-phone",
    alt: "Money in Clientele: earned, deposits online, owed to you and payouts, a chart and how you were paid",
    label: "Money",
    title: "Every dollar in one place.",
    text: "What you earned by day, week, month or year, including cash, Zelle and Cash App. Balances owed, payouts and gift cards too.",
    points: [
      "Record tips and product sales in seconds.",
      "Payment links you send by text or Instagram.",
      "Spreadsheet and PDF downloads for tax time.",
    ],
  },
  {
    key: "clients",
    shot: "dash-clients",
    desk: true,
    phoneShot: "dash-clients-phone",
    alt: "Clients in Clientele: a table of names, phones, last and next visits, with Regular tags",
    label: "Clients",
    title: "Remember everything about everyone.",
    text: "Notes on every visit, their look and formulas, intake forms and signed waivers, all on the client's card.",
    points: [
      "Signed waivers saved as PDFs.",
      "Share a photo of their look after the visit.",
      "Close out the day in a minute with wrap-ups.",
    ],
  },
  {
    key: "found",
    shot: "found",
    alt: "A public profile on Clientele: rating, specialties and next open times",
    label: "Get found",
    title: "A profile clients can find and share.",
    text: "Your work, reviews, prices and next open times on one page. Clients search for you by name and follow you for openings.",
    points: [
      "Reviews only from real visits, and you choose which show.",
      "'Notify me' emails followers when you open times.",
      "Made for your Instagram and TikTok bio.",
    ],
  },
  {
    key: "insights",
    shot: "dash-insights",
    desk: true,
    phoneShot: "dash-insights-phone",
    alt: "Insights in Clientele: revenue and visits this month, how clients come back and top regulars",
    label: "Insights",
    title: "Know what's working.",
    text: "Rebooking, no-shows, your busiest and quietest times, top services and average ticket, compared with last month.",
    points: [
      "See who's overdue and invite them back in one tap.",
      "Spot quiet slots to fill with an offer.",
      "Plain numbers, no spreadsheets.",
    ],
  },
];

export default function FeatureTabs() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const tabsRef = useRef(null);
  const tab = TABS[active];

  // Gently cycle through the tabs until someone picks one (not with
  // reduced motion).
  useEffect(() => {
    if (paused || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setTimeout(() => setActive((i) => (i + 1) % TABS.length), 7000);
    return () => clearTimeout(t);
  }, [active, paused]);

  function pick(i) {
    setPaused(true);
    setActive(i);
  }

  return (
    <div className="ln-fx" onMouseEnter={() => setPaused(true)}>
      <div className="ln-tabs" role="tablist" aria-label="Features" ref={tabsRef}>
        {TABS.map((t, i) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`fx-tab-${t.key}`}
            aria-selected={i === active}
            aria-controls="fx-panel"
            className={i === active ? "ln-tab active" : "ln-tab"}
            onClick={() => pick(i)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className={tab.desk ? "ln-fx-panel" : "ln-fx-panel is-phone"} role="tabpanel" id="fx-panel" aria-labelledby={`fx-tab-${tab.key}`} key={tab.key}>
        <div className="ln-fx-copy">
          <h3>{tab.title}</h3>
          <p>{tab.text}</p>
          <ul className="ln-points">
            {tab.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
        <div className={tab.desk ? "ln-fx-visual is-desk" : "ln-fx-visual"}>
          {tab.desk ? (
            <>
              {/* Wide screens: the window. Phones: the same page on a phone (readable at that size). */}
              <div className="ln-only-wide">
                <DeskShot src={tab.shot} alt={tab.alt} hideOnPhones />
              </div>
              <div className="ln-only-phone">
                <PhoneShot src={tab.phoneShot} height={1208} alt={tab.alt} />
              </div>
            </>
          ) : (
            <PhoneShot src={tab.shot} alt={tab.alt} />
          )}
        </div>
      </div>
    </div>
  );
}
