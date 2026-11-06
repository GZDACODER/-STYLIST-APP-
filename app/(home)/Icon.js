// Small gold line icons for the homepage, drawn for this site (24 x 24).
const ICONS = {
  bell: (
    <>
      <path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 2h-14z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20.5h16" />
      <path d="M6.5 17v-5M11 17V8M15.5 17v-7M20 17V5" />
    </>
  ),
  card: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="1.5" />
      <circle cx="9" cy="11" r="2.2" />
      <path d="M5.8 16.2c.6-1.6 1.8-2.4 3.2-2.4s2.6.8 3.2 2.4M14.5 10h3.5M14.5 13.5h3.5" />
    </>
  ),
  swap: (
    <>
      <path d="M4 8h13l-3-3M20 16H7l3 3" />
    </>
  ),
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

export default function Icon({ name }) {
  return (
    <svg className="hm-icon" viewBox="0 0 24 24" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

