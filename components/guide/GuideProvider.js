"use client";

// First-visit tips: knows which guides this person has seen, and shows one
// guide at a time (GuideTour). Pages ask for their guide with <PageGuide>.
//
// "Seen" is kept on the phone (localStorage) and, once signed in, in Supabase
// (onboarding_guides_seen, step 44 SQL), so it follows a pro to every device.
// A guide waits while another pop-up (a sheet, a dialog) is open.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { GUIDES } from "@/lib/guides";
import GuideTour from "./GuideTour";
import { markGuideSeen, resetGuides } from "@/app/(studio)/dashboard/guideActions";
import { clientSeenGuides, markClientGuideSeen } from "@/app/book/guideActions";

const GuideContext = createContext(null);
export const useGuides = () => useContext(GuideContext);

const storageKey = (scope) => `clientele-guides-seen:${scope}`;

function readLocal(scope) {
  try {
    const list = JSON.parse(window.localStorage.getItem(storageKey(scope)) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeLocal(scope, keys) {
  try {
    window.localStorage.setItem(storageKey(scope), JSON.stringify([...keys]));
  } catch {
    // Private browsing: it just won't be remembered on this phone.
  }
}

// Another pop-up is open (not ours, and not the place this guide lives in).
function otherModalOpen(allowIn) {
  const open = [...document.querySelectorAll('dialog[open], [role="dialog"], [aria-modal="true"]')].filter(
    (el) => !el.closest("[data-guide-layer]") && (el.tagName === "DIALOG" || el.getClientRects().length > 0)
  );
  return open.some((el) => !(allowIn && el.matches(allowIn)));
}

// mode: "pro" (dashboard) or "client" (booking pages).
// scope: the pro's user id (pro), or the booking page's slug (client).
// initialSeen: the pro's seen guides from the server, or null if unknown.
export default function GuideProvider({ mode, scope, initialSeen = null, children }) {
  const [seen, setSeen] = useState(() => new Set(initialSeen || []));
  const [ready, setReady] = useState(false);
  const [queue, setQueue] = useState([]);
  const [active, setActive] = useState(null); // { key, forced }
  const local = mode === "client" ? "client" : scope || "pro";
  const seenRef = useRef(seen);
  seenRef.current = seen;

  // What this phone remembers, plus (clients) what's saved on their login.
  useEffect(() => {
    let cancelled = false;
    const fromPhone = readLocal(local);
    setSeen((s) => new Set([...s, ...fromPhone]));
    if (mode === "client") {
      clientSeenGuides()
        .then((res) => {
          if (cancelled) return;
          if (res?.keys?.length) setSeen((s) => new Set([...s, ...res.keys]));
          setReady(true);
        })
        .catch(() => !cancelled && setReady(true));
    } else {
      setReady(true);
    }
    return () => {
      cancelled = true;
    };
  }, [mode, local]);

  const request = useCallback((key) => {
    if (!GUIDES[key]) return;
    setQueue((q) => (q.includes(key) ? q : [...q, key]));
  }, []);

  const start = useCallback((key) => {
    if (!GUIDES[key]) return;
    setQueue((q) => q.filter((k) => k !== key));
    setActive({ key, forced: true });
  }, []);

  // A page that asked for a guide went away: forget the request, and close
  // its guide if it was showing (it shows again next time).
  const cancel = useCallback((key) => {
    setQueue((q) => q.filter((k) => k !== key));
    setActive((a) => (a && a.key === key && !a.forced ? null : a));
  }, []);

  const markSeen = useCallback(
    (key) => {
      const next = new Set([...seenRef.current, key]);
      setSeen(next);
      writeLocal(local, next);
      const save = mode === "client" ? markClientGuideSeen : markGuideSeen;
      // Everything this phone has seen, so a client who just signed in catches up.
      save([...next]).catch(() => {});
    },
    [local, mode]
  );

  const reset = useCallback(async () => {
    writeLocal(local, []);
    setSeen(new Set());
    setActive(null);
    if (mode === "pro") {
      try {
        return await resetGuides();
      } catch {
        return { ok: false };
      }
    }
    return { ok: true };
  }, [local, mode]);

  // Start the next waiting guide that hasn't been seen, once nothing else is
  // open. Checked every half second while something is waiting.
  useEffect(() => {
    if (!ready || active) return;
    const waiting = queue.filter((k) => !seen.has(k));
    if (waiting.length !== queue.length) setQueue(waiting);
    if (!waiting.length) return;
    let timer;
    const tryStart = () => {
      const key = waiting[0];
      if (otherModalOpen(GUIDES[key].allowIn)) {
        timer = setTimeout(tryStart, 500);
        return;
      }
      setQueue((q) => q.filter((k) => k !== key));
      setActive({ key, forced: false });
    };
    // A moment for the page to settle first.
    timer = setTimeout(tryStart, 700);
    return () => clearTimeout(timer);
  }, [ready, active, queue, seen]);

  const finish = useCallback(() => {
    if (active) markSeen(active.key);
    setActive(null);
  }, [active, markSeen]);

  const value = useMemo(() => ({ ready, seen, request, start, cancel, reset }), [ready, seen, request, start, cancel, reset]);

  return (
    <GuideContext.Provider value={value}>
      {children}
      {active && <GuideTour key={active.key} guide={GUIDES[active.key]} onFinish={finish} />}
    </GuideContext.Provider>
  );
}
