"use client";

// Long lists show the first 20 rows, then "Show more" (20 at a time).
// children: the rows (an array). as: the list element ("ul" by default).
import { Children, useState } from "react";

export default function ShowMore({ children, initial = 20, step = 20, as: List = "ul", className, noun = "more" }) {
  const rows = Children.toArray(children);
  const [shown, setShown] = useState(initial);
  const left = rows.length - shown;
  return (
    <>
      <List className={className}>{rows.slice(0, shown)}</List>
      {left > 0 && (
        <button type="button" className="button secondary small db-show-more" onClick={() => setShown((n) => n + step)}>
          Show {Math.min(step, left)} {noun} ({left} left)
        </button>
      )}
    </>
  );
}
