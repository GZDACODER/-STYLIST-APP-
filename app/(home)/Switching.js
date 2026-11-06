// "Switching from another app?": what only Clientele does, a factual
// comparison with typical booking apps (none named), and how to move.
import Link from "next/link";
import { PLANS, TRIAL_DAYS } from "@/lib/plans";
import { formatPrice } from "@/lib/money";
import Icon from "./Icon";

const price = (cents) => formatPrice(cents).replace(/\.00$/, "");

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
