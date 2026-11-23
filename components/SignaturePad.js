"use client";

// Sign with a finger or mouse. Puts the drawing (a PNG data URL) in a
// hidden input called `name`, empty until something is drawn. Used for the
// pro agreement and client waivers.
import { useEffect, useRef, useState } from "react";

export default function SignaturePad({ name = "signature", label = "Sign here", onChange = null }) {
  const canvas = useRef(null);
  const drawing = useRef(false);
  const [value, setValue] = useState("");

  useEffect(() => {
    const c = canvas.current;
    // Sharp lines on high-density screens.
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    const rect = c.getBoundingClientRect();
    c.width = rect.width * ratio;
    c.height = rect.height * ratio;
    const ctx = c.getContext("2d");
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#12100d";
  }, []);

  const point = (e) => {
    const r = canvas.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = (e) => {
    e.preventDefault();
    canvas.current.setPointerCapture?.(e.pointerId);
    drawing.current = true;
    const ctx = canvas.current.getContext("2d");
    const p = point(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 0.1, p.y + 0.1);
    ctx.stroke();
  };
  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvas.current.getContext("2d");
    const p = point(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    const url = canvas.current.toDataURL("image/png");
    setValue(url);
    onChange?.(url);
  };
  const clear = () => {
    const c = canvas.current;
    c.getContext("2d").clearRect(0, 0, c.width, c.height);
    setValue("");
    onChange?.("");
  };

  return (
    <div className="sig">
      <div className="sig-head">
        <span>{label}</span>
        <button type="button" className="link-button small-text" onClick={clear}>
          Clear
        </button>
      </div>
      <canvas
        ref={canvas}
        className="sig-canvas"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerLeave={up}
        aria-label={label}
        role="img"
      />
      <input type="hidden" name={name} value={value} />
      {!value && <p className="sig-hint">Draw your signature in the box with your finger or mouse.</p>}
    </div>
  );
}
