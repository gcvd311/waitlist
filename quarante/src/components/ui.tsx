"use client";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { useMuted, sfx } from "@/lib/sound";
import { useNow } from "@/hooks/useRoom";
import { Cat } from "./Cat";

export function Wordmark({ className = "" }: { className?: string }) {
  return <span className={`title-face whitespace-nowrap ${className}`}>40 &amp; Questionable</span>;
}

/** The title lockup from the reference: heavy italic, slightly tilted, cream on red. */
export function TitleLockup({ className = "", size = "clamp(3.4rem, 15vw, 9rem)", tagline }: { className?: string; size?: string; tagline?: string }) {
  return (
    <div className={`text-center ${className}`}>
      <h1 className="title-face -rotate-[4deg] drop-shadow-[0_4px_0_rgba(60,0,8,0.35)]" style={{ fontSize: size }}>
        <span className="block leading-[1.02] mb-[0.04em]">40 &amp;</span>
        <span className="block text-[0.47em] leading-[1] tracking-[-0.02em]">Questionable</span>
      </h1>
      {tagline && <p className="font-serif italic font-bold text-[0.36em] mt-4" style={{ fontSize: `calc(${size} * 0.3)` }}>{tagline}</p>}
    </div>
  );
}

/** The cat. Shows the host’s own uploaded artwork when there is some, otherwise the built-in cat. */
export function Mascot({ mascots = [], pose = "peek", index = 0, className = "" }: { mascots?: string[]; pose?: "peek" | "wink" | "hearts" | "sit"; index?: number; className?: string }) {
  const own = mascots.length ? mascots[index % mascots.length] : null;
  if (own)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={own} alt="" className={`object-contain ${className}`} />;
  return <Cat pose={pose} className={className} />;
}

/** A consistent portrait frame: 4:5, cover-cropped, initial when empty. */
export function Portrait({
  photo,
  name,
  className = "",
  dim = false,
  children,
}: {
  photo?: string;
  name: string;
  className?: string;
  dim?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={`relative aspect-[4/5] overflow-hidden rounded-2xl bg-claret ${className}`}>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className={`absolute inset-0 w-full h-full object-cover transition duration-500 ${dim ? "grayscale opacity-45" : ""}`} />
      ) : (
        <span className={`absolute inset-0 grid place-items-center font-serif italic font-bold text-bone/40 text-5xl ${dim ? "opacity-40" : ""}`}>
          {name.trim().charAt(0).toUpperCase() || "?"}
        </span>
      )}
      {children}
    </div>
  );
}

export function MuteButton({ className = "" }: { className?: string }) {
  const [muted, setMuted] = useMuted();
  return (
    <button
      type="button"
      onClick={() => {
        setMuted(!muted);
        if (muted) setTimeout(() => sfx.tap(), 10);
      }}
      className={`label hover:text-bone transition ${className}`}
      aria-label={muted ? "Unmute" : "Mute"}
    >
      {muted ? "Sound off" : "Sound on"}
    </button>
  );
}

export function QR({ value, size = 220, className = "" }: { value: string; size?: number; className?: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    QRCode.toString(value, { type: "svg", margin: 0, color: { dark: "#7A0C19", light: "#FFF5EC" }, errorCorrectionLevel: "M" })
      .then(setSvg)
      .catch(() => setSvg(""));
  }, [value]);
  return (
    <div className={`bg-bone p-3 ${className}`} style={{ width: size, height: size }}>
      <div className="w-full h-full [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
}

/** Countdown driven by server time. Fires onExpire once. */
export function Timer({
  deadline,
  total,
  now,
  paused,
  pausedRemaining,
  onExpire,
  ticks = false,
  variant = "bar",
}: {
  deadline: number | null;
  total: number;
  now: () => number;
  paused: boolean;
  pausedRemaining: number | null;
  onExpire?: () => void;
  ticks?: boolean;
  variant?: "bar" | "number";
}) {
  useNow(100);
  const fired = useRef<number | null>(null);
  const lastTick = useRef<number>(-1);
  const remaining = paused ? pausedRemaining ?? 0 : deadline ? Math.max(0, deadline - now()) : 0;
  const secs = Math.ceil(remaining / 1000);
  const frac = total > 0 ? Math.min(1, remaining / (total * 1000)) : 0;

  useEffect(() => {
    if (!deadline || paused) return;
    if (remaining <= 0 && fired.current !== deadline) {
      fired.current = deadline;
      onExpire?.();
    }
    if (ticks && secs <= 5 && secs > 0 && lastTick.current !== secs) {
      lastTick.current = secs;
      sfx.tick();
    }
  });

  if (!deadline && !paused) return null;
  if (variant === "number")
    return (
      <span className={`font-mono tabular-nums ${secs <= 5 ? "text-rouge" : "text-bone"}`}>
        {paused ? "II" : String(secs).padStart(2, "0")}
      </span>
    );
  return (
    <div className="w-full h-[3px] bg-bone/10 overflow-hidden">
      <div
        className={`h-full ${secs <= 5 ? "bg-rouge" : "bg-acid"} transition-[width] duration-100 ease-linear`}
        style={{ width: `${frac * 100}%` }}
      />
    </div>
  );
}

export function TeamDot({ color, className = "" }: { color: string; className?: string }) {
  return <span className={`inline-block w-2 h-2 rounded-full ${className}`} style={{ background: color }} />;
}

export function PromptText({ text, className = "", scale = 1 }: { text: string; className?: string; scale?: number }) {
  const len = text.length;
  const size = len < 40 ? 1 : len < 80 ? 0.82 : len < 140 ? 0.66 : 0.54;
  return (
    <h1 className={`display ${className}`} style={{ fontSize: `calc(${size * scale} * var(--prompt-size, 3rem))` }}>
      {text}
    </h1>
  );
}

export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [message, onDone]);
  if (!message) return null;
  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-6 z-50 anim-rise bg-bone text-ink px-4 py-3 text-sm max-w-[90vw] shadow-2xl">
      {message}
    </div>
  );
}

export function Avatar({ photo, name, size = 32, ring, className = "" }: { photo?: string; name: string; size?: number; ring?: string; className?: string }) {
  return (
    <span
      className={`inline-grid place-items-center shrink-0 rounded-full overflow-hidden bg-claret text-bone/80 font-serif italic ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.48, boxShadow: ring ? `0 0 0 2px ${ring}` : undefined }}
      aria-hidden
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="w-full h-full object-cover" />
      ) : (
        name.trim().charAt(0).toUpperCase()
      )}
    </span>
  );
}

/** A round "add your photo" control. Opens the front camera on phones. */
export function PhotoPicker({ photo, name, onPick, size = 88 }: { photo?: string; name: string; onPick: (file: File) => void; size?: number }) {
  return (
    <label className="inline-flex items-center gap-4 cursor-pointer group">
      <Avatar photo={photo} name={name || "?"} size={size} className="group-hover:opacity-80 transition" />
      <span className="text-sm text-bone/60 group-hover:text-bone">{photo ? "Change photo" : "Add your photo"}</span>
      <input
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = "";
        }}
      />
    </label>
  );
}

/**
 * Square-ish cropper used everywhere a portrait is uploaded: drag to position, slide to zoom.
 * Output is always 4:5 at 800×1000, so every portrait sits the same way in every frame.
 */
export function Cropper({ file, onDone, onCancel }: { file: File; onDone: (dataUrl: string) => void; onCancel: () => void }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0.5, y: 0.5 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const boxW = 280;
  const boxH = 350;

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const i = new Image();
    i.onload = () => setImg(i);
    i.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!img) return null;
  const base = Math.max(boxW / img.width, boxH / img.height);
  const scale = base * zoom;
  const w = img.width * scale;
  const h = img.height * scale;
  const left = -(w - boxW) * pos.x;
  const top = -(h - boxH) * pos.y;

  function finish() {
    const outW = 800;
    const outH = 1000;
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const k = outW / boxW;
    canvas.getContext("2d")!.drawImage(img!, left * k, top * k, w * k, h * k);
    onDone(canvas.toDataURL("image/jpeg", 0.85));
  }

  return (
    <div className="fixed inset-0 z-[70] bg-ink/90 backdrop-blur grid place-items-center p-4">
      <div className="bg-wine border border-bone/15 p-5 w-full max-w-sm">
        <p className="label mb-3">Position the photo</p>
        <div
          className="relative mx-auto overflow-hidden bg-ink touch-none cursor-move select-none"
          style={{ width: boxW, height: boxH }}
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            const nx = w > boxW ? d.px - (e.clientX - d.x) / (w - boxW) : 0.5;
            const ny = h > boxH ? d.py - (e.clientY - d.y) / (h - boxH) : 0.5;
            setPos({ x: Math.max(0, Math.min(1, nx)), y: Math.max(0, Math.min(1, ny)) });
          }}
          onPointerUp={() => (drag.current = null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img.src} alt="" draggable={false} className="absolute max-w-none pointer-events-none" style={{ left, top, width: w, height: h }} />
        </div>
        <label className="block mt-4">
          <span className="label">Zoom</span>
          <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-full" />
        </label>
        <div className="flex gap-2 mt-4">
          <button className="btn-ghost btn-sm flex-1" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn-acid btn-sm flex-1" onClick={finish}>
            Use photo
          </button>
        </div>
      </div>
    </div>
  );
}
