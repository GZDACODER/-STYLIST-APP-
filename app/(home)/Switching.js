// "Switching from another app?": what only Clientele does, a factual
// comparison with typical booking apps (none named), and how to move.
import Link from "next/link";
import { PLANS, TRIAL_DAYS } from "@/lib/plans";
import { formatPrice } from "@/lib/money";

const price = (cents) => formatPrice(cents).replace(/\.00$/, "");

// Small gold line icons, drawn for this page (24 x 24).
const ICONS = {
  star: <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />,
  repeat: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="1.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4M9 15.5l2 2 4-4.5" />
    </>
  ),
  waitlist: (
    <>
      <path d="M5 6.5h14M5 12h14M5 17.5h8" />
      <path d="M17.5 15.5l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z" />
    </>
  ),
  wrapup: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="1.5" />
      <path d="M9 4V2.8h6V4M8.5 10.5l1.6 1.6 3.2-3.4M8.5 16.5h7" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6z" />
      <path d="M8.8 12.2l2.2 2.2 4.3-4.6" />
    </>
  ),
};

function Icon({ name }) {
  return (
    <svg className="hm-icon" viewBox="0 0 24 24" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

const ONLY = [
  { icon: "star", title: "Regulars First", text: "Regulars-only times and early access to new openings." },
  { icon: "repeat", title: "Standing appointments", text: "A regular's usual time, held for them months ahead." },
  { icon: "waitlist", title: "Smart waitlist", text: "Cancellations go to your waitlist, and regulars hear first." },
  {
    icon: "wrapup",
    title: "End-of-day wrap-up",
    text: "Mark each visit kept, no-show or someone else came. Balances owed get flagged.",
  },
  { icon: "link", title: "Invite links", text: "Let in the new clients you choose, even when you're regulars-only." },
  { icon: "shield", title: "No cut of your clients", text: "No commission on clients, and no booking fees charged to them." },
];

export default function Switching() {
  const rows = [
    ["Regulars-only times", "With Regulars First", "Varies by app"],
    ["Standing appointments held for regulars", "With Regulars First", "Varies by app"],
    ["Waitlist included", "With Waitlist or All-in", "Varies by app"],
    ["End-of-day wrap-up", "Every plan", "Varies by app"],
    ["Cut of new clients", "None", "Some marketplaces charge one"],
    ["Booking fees charged to clients", "None", "Some apps add one"],
    [
      "Price for one pro",
      `${price(PLANS.base.monthlyCents)}/mo, or ${price(PLANS.bundle.monthlyCents)}/mo for everything`,
      "Varies by plan and add-ons",
    ],
  ];

  return (
    <section id="switching" className="hm-section hm-switch">
      <p className="hm-kicker">Switching from another app?</p>
      <h2>
        You built your clientele. Your booking app should <em>protect it.</em>
      </h2>

      <h3 className="hm-switch-sub">Built into Clientele</h3>
      <ul className="hm-only">
        {ONLY.map((f) => (
          <li key={f.title}>
            <Icon name={f.icon} />
            <div>
              <h4>{f.title}</h4>
              <p>{f.text}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="hm-compare-wrap">
        <table className="hm-compare">
          <caption className="visually-hidden">Clientele compared with typical booking apps</caption>
          <thead>
            <tr>
              <th scope="col">
                <span className="visually-hidden">Feature</span>
              </th>
              <th scope="col" className="is-us">
                Clientele
              </th>
              <th scope="col">Typical booking apps</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, us, them]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td className="is-us">{us}</td>
                <td>{them}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hm-fine hm-compare-note">
        Other apps differ by plan and change over time, so check what yours includes today.
        Regulars First (+{price(PLANS.regulars.monthlyCents)}/mo) and Waitlist (+
        {price(PLANS.waitlist.monthlyCents)}/mo) add on to the {price(PLANS.base.monthlyCents)} plan, or
        come together in All-in.
      </p>

      <div className="hm-move">
        <div>
          <h3>Switch in an afternoon.</h3>
          <ul className="hm-move-steps">
            <li>
              <strong>Import your client list.</strong> Export it from your old app as a CSV, and
              Clientele brings in names, numbers, emails and notes.
            </li>
            <li>
              <strong>Keep your old app running during your trial.</strong> Move over at your own
              pace, with nothing to cancel until you&apos;re ready.
            </li>
            <li>
              <strong>We&apos;ll help you move.</strong> Email{" "}
              <a href="mailto:hello@clientelesuite.com">hello@clientelesuite.com</a> and we&apos;ll
              help you get set up.
            </li>
          </ul>
        </div>
        <div className="hm-move-cta">
          <Link href="/signup" className="hm-button">
            Start your {TRIAL_DAYS}-day trial
          </Link>
          <p className="hm-fine">No card needed.</p>
        </div>
      </div>
    </section>
  );
}
