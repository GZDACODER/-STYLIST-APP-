// The hero picture: a gold object floating over a dark plinth that slowly
// turns between a calendar (front) and a salon chair (back). Both faces are
// drawn here in SVG, and the turn is CSS 3D (see .hm-object in home.css).
// No images, no 3D libraries. With "reduce motion" on, the calendar stays put.

// The shared gold: a polished face, a dark edge and a soft shine.
function Gold({ id }) {
  return (
    <>
      <linearGradient id={`${id}-face`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#f6e6bd" />
        <stop offset="30%" stopColor="#d9bc80" />
        <stop offset="58%" stopColor="#b8975a" />
        <stop offset="82%" stopColor="#7d6232" />
        <stop offset="100%" stopColor="#4a3818" />
      </linearGradient>
      <linearGradient id={`${id}-deep`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#8a6c38" />
        <stop offset="100%" stopColor="#2e2310" />
      </linearGradient>
      <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#fff6dc" stopOpacity="0.9" />
        <stop offset="45%" stopColor="#fff6dc" stopOpacity="0.12" />
        <stop offset="100%" stopColor="#fff6dc" stopOpacity="0" />
      </linearGradient>
      <radialGradient id={`${id}-shine`} cx="28%" cy="20%" r="55%">
        <stop offset="0%" stopColor="#fffaf0" stopOpacity="0.45" />
        <stop offset="100%" stopColor="#fffaf0" stopOpacity="0" />
      </radialGradient>
    </>
  );
}

// A five-pointed star centred on (cx, cy).
function starPath(cx, cy, outer, inner) {
  const points = [];
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 ? inner : outer;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    points.push(`${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return `M ${points.join(" L ")} Z`;
}

// Front: a wall calendar with two rings, a month grid and one date marked
// with a star (a regular's booking).
function Calendar() {
  const cols = 7;
  const rows = 5;
  const gridX = 56;
  const gridY = 132;
  const cell = 28;
  const gap = 5;
  const marked = { row: 2, col: 4 };
  const cells = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      // The month starts on a Wednesday and has 31 days.
      const day = r * cols + c - 2;
      if (day < 1 || day > 31) continue;
      cells.push({ r, c, x: gridX + c * (cell + gap), y: gridY + r * (cell + gap) });
    }
  }

  return (
    <svg className="hm-face hm-face-front" viewBox="0 0 340 340" aria-hidden="true">
      <defs>
        <Gold id="cal" />
        <clipPath id="cal-clip">
          <rect x="36" y="58" width="268" height="250" rx="22" />
        </clipPath>
      </defs>

      {/* Depth: the card's thickness, behind and below. */}
      <rect x="42" y="66" width="268" height="250" rx="22" fill="url(#cal-deep)" />
      <rect x="36" y="58" width="268" height="250" rx="22" fill="url(#cal-face)" />

      {/* The header band, a little darker. */}
      <g clipPath="url(#cal-clip)">
        <rect x="36" y="58" width="268" height="58" fill="#6b5328" opacity="0.55" />
        <rect x="0" y="0" width="340" height="340" fill="url(#cal-shine)" />
      </g>
      {/* The month name, as fine lines (no text to load). */}
      <rect x="132" y="82" width="76" height="6" rx="3" fill="#f6e6bd" opacity="0.85" />
      <rect x="150" y="96" width="40" height="4" rx="2" fill="#f6e6bd" opacity="0.45" />

      {/* The grid: engraved squares. */}
      {cells.map(({ r, c, x, y }) =>
        r === marked.row && c === marked.col ? null : (
          <rect key={`${r}-${c}`} x={x} y={y} width={cell} height={cell} rx="6" fill="#4a3818" opacity="0.32" />
        )
      )}
      {/* The marked date: raised, with a star. */}
      {(() => {
        const x = gridX + marked.col * (cell + gap);
        const y = gridY + marked.row * (cell + gap);
        return (
          <g>
            <rect x={x - 3} y={y - 3} width={cell + 6} height={cell + 6} rx="8" fill="#1a140a" />
            <path d={starPath(x + cell / 2, y + cell / 2, 10, 4.2)} fill="#e9cf94" />
          </g>
        );
      })()}

      <rect
        x="36"
        y="58"
        width="268"
        height="250"
        rx="22"
        fill="none"
        stroke="url(#cal-edge)"
        strokeWidth="2"
      />

      {/* The two rings at the top. */}
      {[112, 228].map((x) => (
        <g key={x}>
          <rect x={x - 9} y="66" width="18" height="10" rx="5" fill="#2a1f0d" />
          <rect x={x - 7} y="30" width="14" height="44" rx="7" fill="url(#cal-face)" />
          <rect x={x - 7} y="30" width="14" height="44" rx="7" fill="none" stroke="url(#cal-edge)" strokeWidth="1.5" />
        </g>
      ))}
    </svg>
  );
}

// Back: a classic salon chair, side view (facing left).
function Chair() {
  return (
    <svg className="hm-face hm-face-back" viewBox="0 0 340 340" aria-hidden="true">
      <defs>
        <Gold id="ch" />
      </defs>

      <g transform="translate(6 4)">
        {/* Base and pump pedal. */}
        <ellipse cx="170" cy="300" rx="78" ry="13" fill="url(#ch-deep)" />
        <ellipse cx="170" cy="294" rx="78" ry="13" fill="url(#ch-face)" />
        <rect x="196" y="276" width="34" height="7" rx="3.5" fill="url(#ch-face)" />

        {/* The column. */}
        <rect x="158" y="210" width="24" height="86" rx="6" fill="url(#ch-deep)" />
        <rect x="160" y="210" width="10" height="86" rx="4" fill="#f6e6bd" opacity="0.25" />

        {/* Footrest. */}
        <path d="M 104 214 L 76 268" stroke="url(#ch-deep)" strokeWidth="10" strokeLinecap="round" />
        <rect x="50" y="262" width="56" height="10" rx="5" fill="url(#ch-face)" />

        {/* Backrest, leaning back, with a headrest on a stem. */}
        <g transform="rotate(14 226 140)">
          <rect x="234" y="34" width="8" height="34" rx="4" fill="url(#ch-deep)" />
          <rect x="214" y="20" width="48" height="24" rx="12" fill="url(#ch-face)" />
          <rect x="206" y="64" width="44" height="140" rx="20" fill="url(#ch-deep)" transform="translate(6 4)" />
          <rect x="206" y="64" width="44" height="140" rx="20" fill="url(#ch-face)" />
          <rect x="206" y="64" width="44" height="140" rx="20" fill="url(#ch-shine)" />
          <rect x="206" y="64" width="44" height="140" rx="20" fill="none" stroke="url(#ch-edge)" strokeWidth="1.6" />
          {/* Tufted lines in the upholstery. */}
          {[100, 132, 164].map((y) => (
            <line key={y} x1="216" y1={y} x2="240" y2={y} stroke="#4a3818" strokeOpacity="0.35" strokeWidth="2" />
          ))}
        </g>

        {/* Seat cushion. */}
        <rect x="96" y="190" width="150" height="34" rx="14" fill="url(#ch-deep)" transform="translate(5 5)" />
        <rect x="96" y="190" width="150" height="34" rx="14" fill="url(#ch-face)" />
        <rect x="96" y="190" width="150" height="34" rx="14" fill="url(#ch-shine)" />
        <rect x="96" y="190" width="150" height="34" rx="14" fill="none" stroke="url(#ch-edge)" strokeWidth="1.6" />

        {/* Armrest on its support. */}
        <rect x="128" y="166" width="12" height="28" rx="4" fill="url(#ch-deep)" />
        <rect x="100" y="152" width="122" height="18" rx="9" fill="url(#ch-face)" />
        <rect x="100" y="152" width="122" height="18" rx="9" fill="none" stroke="url(#ch-edge)" strokeWidth="1.4" />
      </g>
    </svg>
  );
}

export default function HeroObject() {
  return (
    <div className="hm-object" role="img" aria-label="A gold calendar that turns into a salon chair">
      {/* Soft gold light, the plinth and its shadow (these don't turn). */}
      <svg className="hm-object-stage" viewBox="0 0 400 420" aria-hidden="true">
        <defs>
          <radialGradient id="st-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#b8975a" stopOpacity="0.32" />
            <stop offset="45%" stopColor="#b8975a" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#b8975a" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="st-shadow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#000" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#000" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="st-plinth" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2a2722" />
            <stop offset="100%" stopColor="#0d0c0a" />
          </linearGradient>
        </defs>
        <circle cx="200" cy="200" r="240" fill="url(#st-glow)" />
        <ellipse cx="200" cy="372" rx="150" ry="20" fill="url(#st-plinth)" />
        <ellipse cx="200" cy="368" rx="150" ry="18" fill="none" stroke="#b8975a" strokeOpacity="0.35" />
        <ellipse className="hm-object-shadow" cx="204" cy="362" rx="118" ry="12" fill="url(#st-shadow)" />
      </svg>

      <div className="hm-object-float">
        <div className="hm-object-turn">
          <Calendar />
          <Chair />
        </div>
      </div>
    </div>
  );
}
