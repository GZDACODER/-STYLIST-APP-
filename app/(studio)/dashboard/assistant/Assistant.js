"use client";

// The chat: your messages, the assistant's replies, and a card to Confirm or
// Cancel each change it proposes. The conversation lives in this page (and
// this tab's session storage), so it's gone when you start a new chat.
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
      if (text) out.push({ key: `a${i}`, who: "assistant", text });
    }
  });
  return out;
}

export default function Assistant() {
  const router = useRouter();
  const [messages, setMessages] = useState([]);
  const [pending, setPending] = useState(null);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);
  const [text, setText] = useState("");
  const [busy, startTransition] = useTransition();
  const endRef = useRef(null);

  // Keep the chat if the page is reloaded (this tab only). Saving waits
  // until the saved chat has been read, so it can't be overwritten first.
  const [loaded, setLoaded] = useState(false);
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
    if (messages.length) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [loaded, messages, pending, busy]);

  function apply(result) {
    setMessages(result.messages || []);
    setPending(result.pending || null);
    setError(result.error || null);
    if (result.done?.ok) {
      setNotice(result.done.ok);
      router.refresh();
    } else if (result.done?.error) {
      setNotice(null);
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
    setMessages((m) => [...m, { role: "user", content: clean, optimistic: true }]);
    const history = messages;
    startTransition(async () => {
      const result = await sendToAssistant(history, clean);
      apply(result);
    });
  }

  function answer(approve) {
    if (!pending || busy) return;
    const id = pending.toolUseId;
    setNotice(null);
    setError(null);
    startTransition(async () => {
      const result = await answerAssistant(messages, id, approve);
      apply(result);
    });
  }

  function newChat() {
    setMessages([]);
    setPending(null);
    setNotice(null);
    setError(null);
    try {
      sessionStorage.removeItem(STORE_KEY);
    } catch {}
  }

  const shown = visible(messages);

  return (
    <div className="assistant">
      <div className="assistant-log" aria-live="polite">
        {shown.length === 0 && !busy && (
          <div className="assistant-empty">
            <p className="muted">Try:</p>
            <div className="assistant-suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" className="assistant-chip" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {shown.map((m) => (
          <div key={m.key} className={`assistant-msg ${m.who}`}>
            {m.text}
          </div>
        ))}
        {busy && <div className="assistant-msg assistant thinking">Checking your schedule…</div>}
        {pending && !busy && (
          <div className="assistant-confirm" role="group" aria-label="Confirm this change">
            <p className="assistant-confirm-label">Make this change?</p>
            <p>{pending.summary}</p>
            <div className="confirm-actions">
              <button type="button" className="button small" onClick={() => answer(true)}>
                Confirm
              </button>
              <button type="button" className="button small secondary" onClick={() => answer(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}
        {notice && <p className="message success small-text">{notice}</p>}
        {error && <p className="message error small-text">{error}</p>}
        <div ref={endRef} />
      </div>

      <form
        className="assistant-input"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <label className="visually-hidden" htmlFor="assistant-text">
          Message the assistant
        </label>
        <textarea
          id="assistant-text"
          rows={2}
          maxLength={2000}
          placeholder="e.g. Block off next Tuesday from 2 to 4"
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
        <div className="assistant-input-row">
          {messages.length > 0 && (
            <button type="button" className="link-button quiet-link" onClick={newChat} disabled={busy}>
              New chat
            </button>
          )}
          <button type="submit" className="button small" disabled={busy || !text.trim()}>
            {busy ? "Working…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
