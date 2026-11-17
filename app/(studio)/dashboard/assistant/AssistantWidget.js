"use client";

// The Assistant as a chat that pops up from a round button in the bottom
// corner of every dashboard page. Your messages, the assistant's replies,
// and a card to Confirm or Cancel each change it proposes. The conversation
// lives in this tab's session storage until "New chat" or the tab closes.
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { answerAssistant, sendToAssistant } from "./actions";

const STORE_KEY = "clientele-assistant-chat";
const SUGGESTIONS = [
  "What does my week look like?",
  "Block off Friday afternoon",
  "Who's booked tomorrow?",
  "I'm on vacation Dec 22 to Jan 2",
];

// What to show from the conversation: your words and the assistant's text
// (tool calls, results and thinking stay hidden).
function visible(messages) {
  const out = [];
  messages.forEach((m, i) => {
    if (m.role === "user") {
      const text =
        typeof m.content === "string"
          ? m.content
          : (m.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
      if (text) out.push({ key: `u${i}`, who: "you", text });
    } else if (m.role === "assistant") {
      const text = (m.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      if (text) out.push({ key: `a${i}`, who: "bot", text });
    }
  });
  return out;
}

function Sparkle({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
      <path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
    </svg>
  );
}

// locked: the Assistant isn't on this account's plan (no add-on, trial over).
// The button still shows; opening it explains the add-on and links to Plan &
// billing instead of the chat (the server refuses chat requests anyway).
export default function AssistantWidget({ firstName = "", locked = false, price = "$15/mo" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [pending, setPending] = useState(null);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);
  const [text, setText] = useState("");
  const [busy, startTransition] = useTransition();
  const [loaded, setLoaded] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  // Keep the chat if the page changes or reloads (this tab only). Saving
  // waits until the saved chat has been read, so it can't be overwritten.
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORE_KEY) || "null");
      if (Array.isArray(saved?.messages)) {
        setMessages(saved.messages);
        setPending(saved.pending || null);
      }
    } catch {}
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify({ messages, pending }));
    } catch {}
  }, [loaded, messages, pending]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: "end" });
  }, [open, messages, pending, busy, notice, error]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function apply(result) {
    setMessages(result.messages || []);
    setPending(result.pending || null);
    setError(result.error || null);
    if (result.done?.ok) {
      setNotice(result.done.ok);
      router.refresh();
    }
  }

  function send(value) {
    const clean = String(value || "").trim();
    if (!clean || busy) return;
    setText("");
    setNotice(null);
    setError(null);
    setPending(null);
    // Show their message straight away.
    const history = messages;
    setMessages((m) => [...m, { role: "user", content: clean }]);
    startTransition(async () => {
      apply(await sendToAssistant(history, clean));
    });
  }

  function answer(approve) {
    if (!pending || busy) return;
    const id = pending.toolUseId;
    setNotice(null);
    setError(null);
    startTransition(async () => {
      apply(await answerAssistant(messages, id, approve));
    });
  }

  function newChat() {
    setMessages([]);
    setPending(null);
    setNotice(null);
    setError(null);
    inputRef.current?.focus();
  }

  const shown = visible(messages);
  const hello = String(firstName || "").trim();

  return (
    <div className="aw">
      {open && (
        <section className="aw-panel" role="dialog" aria-label="Assistant">
          <header className="aw-head">
            <span className="aw-avatar">
              <Sparkle size={18} />
            </span>
            <div className="aw-title">
              <strong>Assistant</strong>
              <span>Your schedule, in plain words</span>
            </div>
            {messages.length > 0 && (
              <button type="button" className="aw-icon-btn" onClick={newChat} disabled={busy} title="New chat" aria-label="New chat">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                  <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-4-4L4 16z" />
                </svg>
              </button>
            )}
            <button type="button" className="aw-icon-btn" onClick={() => setOpen(false)} aria-label="Close">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </header>

          {locked ? (
            <div className="aw-log">
              <div className="aw-welcome">
                <p className="aw-bubble bot">
                  Hi{hello ? ` ${hello}` : ""}! I can answer questions about your schedule and make changes in your
                  own words, like &quot;block off Friday afternoon&quot; or &quot;who&apos;s booked tomorrow?&quot;. I
                  always check with you before changing anything.
                </p>
                <p className="aw-note ok">
                  The Assistant is an add-on for {price}. Add it in Plan &amp; billing to start chatting.
                </p>
                <a href="/dashboard/settings/plan" className="aw-btn primary aw-unlock">
                  Add the Assistant
                </a>
              </div>
            </div>
          ) : (
          <>
          <div className="aw-log" aria-live="polite">
            {shown.length === 0 && !busy && (
              <div className="aw-welcome">
                <p className="aw-bubble bot">
                  Hi{hello ? ` ${hello}` : ""}! Ask me about your schedule, or tell me what to change.
                  I&apos;ll check with you before changing anything.
                </p>
                <div className="aw-chips">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} type="button" className="aw-chip" onClick={() => send(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {shown.map((m) => (
              <p key={m.key} className={`aw-bubble ${m.who}`}>
                {m.text}
              </p>
            ))}
            {busy && (
              <p className="aw-bubble bot aw-typing" aria-label="Thinking">
                <i />
                <i />
                <i />
              </p>
            )}
            {pending && !busy && (
              <div className="aw-confirm" role="group" aria-label="Confirm this change">
                <span className="aw-confirm-label">Make this change?</span>
                <p>{pending.summary}</p>
                <div className="aw-confirm-actions">
                  <button type="button" className="aw-btn primary" onClick={() => answer(true)}>
                    Confirm
                  </button>
                  <button type="button" className="aw-btn" onClick={() => answer(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {notice && <p className="aw-note ok">{notice}</p>}
            {error && <p className="aw-note err">{error}</p>}
            <div ref={endRef} />
          </div>

          <form
            className="aw-input"
            onSubmit={(e) => {
              e.preventDefault();
              send(text);
            }}
          >
            <label className="visually-hidden" htmlFor="aw-text">
              Message the assistant
            </label>
            <textarea
              id="aw-text"
              ref={inputRef}
              rows={1}
              maxLength={2000}
              placeholder="Ask or tell me what to change…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(text);
                }
              }}
              disabled={busy}
            />
            <button type="submit" className="aw-send" disabled={busy || !text.trim()} aria-label="Send">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          </form>
          </>
          )}
        </section>
      )}

      <button
        type="button"
        className={`aw-launcher${open ? " open" : ""}${pending && !open ? " waiting" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close assistant" : "Open assistant"}
        aria-expanded={open}
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
          </svg>
        ) : (
          <Sparkle />
        )}
      </button>
    </div>
  );
}
