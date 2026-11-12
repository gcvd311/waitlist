"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, hostKey, resizeImage, store } from "@/lib/client";
import { Wordmark } from "@/components/ui";
import { ImportBox, PlayersTab } from "@/components/AdminPlayers";
import { DEFAULT_CONTENT } from "@/lib/defaultContent";
import { ENCORE_DEFAULT, uid } from "@/lib/engine";
import type { Content, ContentQuestion, Encore, QType, RoundKind } from "@/lib/types";

type Tab = "her" | "rounds" | "questions" | "friends" | "play" | "players";
type QSet = "knowHer" | "past40" | "men" | "finale" | "honoreeVs" | "final40" | "trivia" | "tiebreakers";

const TABS: { id: Tab; label: string }[] = [
  { id: "play", label: "Play" },
  { id: "players", label: "Players & portraits" },
  { id: "her", label: "Her" },
  { id: "questions", label: "Questions" },
  { id: "friends", label: "Friends" },
  { id: "rounds", label: "Rounds & scoring" },
];

export default function AdminPage() {
  const [auth, setAuth] = useState<{ admin: boolean; configured: boolean; devDefault: boolean } | null>(null);
  useEffect(() => {
    api<{ admin: boolean; configured: boolean; devDefault: boolean }>("/api/admin/login").then(setAuth).catch(() => setAuth({ admin: false, configured: false, devDefault: false }));
  }, []);
  if (!auth) return <main className="min-h-[100dvh] grid place-items-center label anim-pulse">One moment…</main>;
  if (!auth.admin) return <Login devDefault={auth.devDefault} configured={auth.configured} onDone={() => setAuth({ ...auth, admin: true })} />;
  return <Dashboard />;
}

function Login({ onDone, devDefault, configured }: { onDone: () => void; devDefault: boolean; configured: boolean }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <main className="min-h-[100dvh] px-6 py-10 max-w-sm mx-auto flex flex-col justify-center">
      <Wordmark className="text-3xl" />
      <h1 className="display text-5xl mt-10">The host’s table.</h1>
      <form
        className="mt-10 space-y-6"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await api("/api/admin/login", { method: "POST", body: JSON.stringify({ password: pw }) });
            onDone();
          } catch (e) {
            setErr((e as Error).message);
          }
        }}
      >
        <input type="password" className="field" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
        {err && <p className="text-rouge text-sm">{err}</p>}
        {!configured && <p className="text-rouge text-sm">ADMIN_PASSWORD is not set on the server.</p>}
        {devDefault && <p className="text-bone/40 text-sm">Local mode: the password is “quarante” until you set ADMIN_PASSWORD.</p>}
        <button className="btn-acid w-full">Enter</button>
      </form>
    </main>
  );
}

function Dashboard() {
  const router = useRouter();
  const [content, setContent] = useState<Content | null>(null);
  const [backend, setBackend] = useState<string>("");
  const [tab, setTab] = useState<Tab>("play");
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving" | "error">("saved");
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const first = useRef(true);

  useEffect(() => {
    api<{ content: Content; backend: string }>("/api/content").then((r) => {
      setContent(r.content);
      setBackend(r.backend);
    });
  }, []);

  // Autosave, debounced.
  useEffect(() => {
    if (!content) return;
    if (first.current) {
      first.current = false;
      return;
    }
    setSaveState("dirty");
    const t = setTimeout(async () => {
      setSaveState("saving");
      try {
        await api("/api/content", { method: "PUT", body: JSON.stringify({ content }) });
        setSaveState("saved");
        setSaveErr(null);
      } catch (e) {
        setSaveState("error");
        setSaveErr((e as Error).message);
      }
    }, 900);
    return () => clearTimeout(t);
  }, [content]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (saveState === "dirty" || saveState === "saving") e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveState]);

  if (!content) return <main className="min-h-[100dvh] grid place-items-center label anim-pulse">Opening the archive…</main>;
  const update = (fn: (c: Content) => void) =>
    setContent((c) => {
      const next = structuredClone(c!);
      fn(next);
      return next;
    });

  return (
    <main className="min-h-[100dvh] max-w-5xl mx-auto px-5 pb-24">
      <header className="flex items-center justify-between py-5 gap-4">
        <Link href="/">
          <Wordmark className="text-2xl" />
        </Link>
        <div className="flex items-center gap-4">
          <span className={`label ${saveState === "error" ? "text-rouge" : saveState === "saved" ? "" : "text-acid"}`}>
            {saveState === "saved" ? "Saved" : saveState === "saving" ? "Saving…" : saveState === "dirty" ? "Unsaved" : "Not saved"}
          </span>
          <button
            className="label hover:text-bone"
            onClick={async () => {
              await api("/api/admin/login", { method: "DELETE" });
              router.refresh();
              location.reload();
            }}
          >
            Sign out
          </button>
        </div>
      </header>
      {saveErr && <p className="text-rouge text-sm mb-3">{saveErr}</p>}
      {backend === "memory" && (
        <p className="text-sm border border-acid/40 text-acid/90 px-4 py-3 mb-5">
          Local mode: no Supabase configured, so edits live in server memory and vanish when the server restarts. Export a backup in Play, or connect Supabase (see README).
        </p>
      )}

      <div className="card px-5 sm:px-8 py-6">
      <nav className="flex gap-1 overflow-x-auto border-b border-bone/15 mb-8 -mx-5 sm:-mx-8 px-5 sm:px-8">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-3 font-mono uppercase tracking-label text-[15px] whitespace-nowrap border-b-[3px] -mb-px transition ${tab === t.id ? "border-acid text-acid" : "border-transparent text-bone/50 hover:text-bone"}`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "play" && <PlayTab content={content} setContent={setContent} saveState={saveState} />}
      {tab === "players" && <PlayersTab content={content} update={update} />}
      {tab === "her" && <HerTab content={content} update={update} />}
      {tab === "questions" && <QuestionsTab content={content} update={update} />}
      {tab === "friends" && <FriendsTab content={content} update={update} />}
      {tab === "rounds" && <RoundsTab content={content} update={update} />}
      </div>
    </main>
  );
}

type Update = (fn: (c: Content) => void) => void;

function Section({ title, hint, children, action }: { title: string; hint?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="mb-12">
      <div className="flex items-end justify-between gap-4 mb-4">
        <div>
          <h2 className="display text-3xl">{title}</h2>
          {hint && <p className="text-bone/50 text-sm mt-1 max-w-2xl">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

// ───────────────────────── Play ─────────────────────────

function PlayTab({ content, setContent, saveState }: { content: Content; setContent: (c: Content) => void; saveState: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const her = content.honoreeAnswers ?? {};
  const placeholders = [...content.questions.knowHer, ...content.questions.final40].filter((q) => q.placeholder && her[q.id] === undefined).length;
  const herTotal =
    content.questions.knowHer.filter((q) => !q.off && !q.optionsFrom).length + (content.questions.finale ?? []).filter((q) => q.askHer && !q.off).length;
  const girls = content.players ?? [];
  const roundsShort = content.rounds.filter((r) => r.enabled && r.kind !== "whoSaid" && r.kind !== "mostLikely").filter((r) => {
    const list = (content.questions as unknown as Record<string, { off?: boolean; bonus?: boolean }[]>)[r.kind] ?? [];
    return list.filter((q) => !q.off && !q.bonus).length < r.count;
  });
  const herDone = Object.keys(her).length;
  const enabled = content.rounds.filter((r) => r.enabled);

  async function host(preview: boolean) {
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ code: string; hostToken: string }>("/api/rooms", { method: "POST" });
      store.set(hostKey(r.code), r.hostToken);
      if (preview) {
        window.open(`/host/${r.code}`, "_blank");
        window.open(`/join/${r.code}`, "_blank");
        setBusy(false);
      } else router.push(`/host/${r.code}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div>
      <Section title="Start a game" hint="Opens the host screen. Put it on the biggest screen you have; everyone joins on their phone with the room code.">
        <div className="flex flex-wrap gap-3">
          <button className="btn-acid text-lg px-8 py-5" disabled={busy || saveState === "saving" || saveState === "dirty"} onClick={() => host(false)}>
            Host a new game
          </button>
          <button className="btn-ghost" disabled={busy} onClick={() => host(true)}>
            Preview (host + a test player)
          </button>
          <Link href="/solo" className="btn-ghost">
            Pass &amp; play on one phone
          </Link>
        </div>
        {err && <p className="text-rouge text-sm mt-3">{err}</p>}
        <p className="text-bone/40 text-sm mt-4">
          The game takes a snapshot of these settings when it starts. Edits made afterwards apply to the next game.
        </p>
      </Section>

      <Section title="Readiness">
        <ul className="divide-y divide-bone/10 border-y border-bone/10">
          <Check ok={content.honoree.name !== DEFAULT_CONTENT.honoree.name} label="Her name" detail={content.honoree.name} />
          <Check ok={content.honoree.photos.length > 0} label="Photographs" detail={`${content.honoree.photos.length} uploaded`} />
          <Check ok={girls.length >= 2 && girls.every((g) => g.photo)} label="Players’ portraits" detail={`${girls.filter((g) => g.photo).length} of ${girls.length} uploaded`} />
          <Check
            ok={girls.length >= 2 && girls.every((g) => g.malePhotos.length && g.maleName.trim())}
            label="Men’s portraits and names"
            detail={`${girls.filter((g) => g.malePhotos.length).length} of ${girls.length} have a portrait`}
          />
          <Check ok={!roundsShort.length} label="Questions switched on" detail={roundsShort.length ? `Short in: ${roundsShort.map((r) => r.title.replace("{name}", content.honoree.name)).join(", ")}` : "Every round has enough"} />
          <Check ok={!!content.honoreePassword} label="Her password" detail={content.honoreePassword ? "Set (see the Her tab)" : "Set one in the Her tab so she can log in"} />
          <Check ok={herDone >= herTotal && herTotal > 0} label="Her answers" detail={`${Math.min(herDone, herTotal)} of ${herTotal} answered by her`} />
          <Check ok={placeholders === 0} label="Placeholder questions" detail={placeholders ? `${placeholders} still need her real answers` : "None left"} />
          <Check ok={content.confessions.length >= 5} label="Confessions for Who Said That?" detail={`${content.confessions.length} collected (players can add more in the lobby)`} />
          <Check ok={content.messages.length > 0} label="Messages for the final screen" detail={`${content.messages.length}`} />
          <Check ok={enabled.length > 0} label="Rounds" detail={enabled.map((r) => r.title.replace("{name}", content.honoree.name)).join(" · ")} />
        </ul>
      </Section>

      <Section title="Collect confessions before the trip" hint="Send this link to the group. Each friend submits up to three confessions and a message for her. Their names stay hidden until the reveal.">
        <div className="flex gap-2 items-center">
          <input readOnly className="box font-mono text-sm" value={`${origin}/confess`} onFocus={(e) => e.target.select()} />
          <button className="btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(`${origin}/confess`)}>
            Copy
          </button>
        </div>
      </Section>

      <Section title="Backup" hint="Download everything as JSON, or restore a backup.">
        <div className="flex flex-wrap gap-3">
          <button
            className="btn-ghost btn-sm"
            onClick={() => {
              const blob = new Blob([JSON.stringify(content, null, 2)], { type: "application/json" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = "quarante-content.json";
              a.click();
            }}
          >
            Export JSON
          </button>
          <label className="btn-ghost btn-sm cursor-pointer">
            Import JSON
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  const c = JSON.parse(await f.text());
                  if (!c.questions || !c.rounds) throw new Error();
                  if (confirm("Replace all current content with this file?")) setContent(c);
                } catch {
                  alert("That file isn’t a Quarante backup.");
                }
              }}
            />
          </label>
          <button className="btn-ghost btn-sm text-rouge" onClick={() => confirm("Reset everything to the sample content? This cannot be undone.") && setContent(structuredClone(DEFAULT_CONTENT))}>
            Reset to sample content
          </button>
        </div>
      </Section>
    </div>
  );
}

function Check({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <li className="flex items-baseline gap-4 py-3">
      <span className={`font-mono text-xs w-10 ${ok ? "text-acid" : "text-rouge"}`}>{ok ? "Ready" : "To do"}</span>
      <span className="w-56 shrink-0">{label}</span>
      <span className="text-bone/50 text-sm truncate">{detail}</span>
    </li>
  );
}

// ───────────────────────── Her ─────────────────────────

function HerTab({ content, update }: { content: Content; update: Update }) {
  const [uploading, setUploading] = useState(0);
  const h = content.honoree;
  return (
    <div>
      <Section title="The birthday girl" hint="Her name fills every {name} in the questions.">
        <div className="grid sm:grid-cols-2 gap-6">
          <div>
            <label className="label block mb-1">Name</label>
            <input className="field font-serif text-3xl" value={h.name} onChange={(e) => update((c) => void (c.honoree.name = e.target.value))} />
          </div>
          <div>
            <label className="label block mb-1">Line for the final screen</label>
            <input className="field" value={h.tagline} onChange={(e) => update((c) => void (c.honoree.tagline = e.target.value))} />
          </div>
        </div>
      </Section>

      <HerLogin content={content} update={update} />

      <MascotSection content={content} update={update} />

      <Section title="Photographs" hint="Shown on round openings and the final screen. Resized in your browser before upload.">
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {h.photos.map((p, i) => (
            <div key={p.slice(-40) + i} className="relative group aspect-[3/4] bg-bone/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p} alt="" className="w-full h-full object-cover" />
              <button
                className="absolute top-1 right-1 bg-ink/80 text-xs px-2 py-1 opacity-80 hover:opacity-100"
                onClick={() => update((c) => void c.honoree.photos.splice(i, 1))}
              >
                Remove
              </button>
            </div>
          ))}
          <label className="aspect-[3/4] border border-dashed border-bone/25 grid place-items-center text-center text-sm text-bone/50 cursor-pointer hover:border-acid hover:text-bone">
            {uploading ? `Uploading ${uploading}…` : "Add photos"}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={async (e) => {
                const files = Array.from(e.target.files ?? []);
                setUploading(files.length);
                for (const f of files) {
                  try {
                    const dataUrl = await resizeImage(f);
                    const { url } = await api<{ url: string }>("/api/admin/upload", { method: "POST", body: JSON.stringify({ dataUrl }) });
                    update((c) => void c.honoree.photos.push(url));
                  } catch (err) {
                    alert((err as Error).message);
                  }
                  setUploading((n) => n - 1);
                }
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </Section>

      <Section
        title="Facts and stories"
        hint="Your notes. Use them to write questions; the host screen also shows one between rounds."
        action={
          <button className="btn-ghost btn-sm" onClick={() => update((c) => void c.honoree.facts.push({ id: uid(6), text: "" }))}>
            Add
          </button>
        }
      >
        <div className="space-y-2">
          {h.facts.map((f, i) => (
            <div key={f.id} className="flex gap-2">
              <textarea className="box min-h-[56px]" value={f.text} placeholder="She once…" onChange={(e) => update((c) => void (c.honoree.facts[i].text = e.target.value))} />
              <button className="label hover:text-rouge" onClick={() => update((c) => void c.honoree.facts.splice(i, 1))}>
                Delete
              </button>
            </div>
          ))}
          {!h.facts.length && <p className="text-bone/40 font-serif italic text-xl">Nothing yet.</p>}
        </div>
      </Section>
    </div>
  );
}

async function uploadFile(f: File): Promise<string> {
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(f);
  });
  const small = await shrink(dataUrl, 1600);
  const { url } = await api<{ url: string }>("/api/admin/upload", { method: "POST", body: JSON.stringify({ dataUrl: small }) });
  return url;
}

/** Scale a photo down so uploads stay quick on party wifi. PNGs keep their transparency. */
function shrink(dataUrl: string, max: number): Promise<string> {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      if (k === 1 && dataUrl.length < 2_500_000) return res(dataUrl);
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.width * k);
      cv.height = Math.round(img.height * k);
      cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
      res(dataUrl.startsWith("data:image/png") ? cv.toDataURL("image/png") : cv.toDataURL("image/jpeg", 0.86));
    };
    img.onerror = () => res(dataUrl);
    img.src = dataUrl;
  });
}

function ImageSlot({ url, onChange, label, className = "w-28 h-28" }: { url?: string; onChange: (url: string) => void; label: string; className?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="text-center shrink-0">
      <label className={`${className} rounded-2xl border-2 border-dashed border-bone/25 grid place-items-center text-center text-sm text-bone/55 cursor-pointer hover:border-acid overflow-hidden`}>
        {busy ? (
          "Uploading…"
        ) : url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="w-full h-full object-cover" />
        ) : (
          label
        )}
        <input
          type="file"
          accept="image/png,image/webp,image/jpeg"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setBusy(true);
            try {
              onChange(await uploadFile(f));
            } catch (err) {
              alert((err as Error).message);
            }
            setBusy(false);
            e.target.value = "";
          }}
        />
      </label>
      {url && (
        <button className="label hover:text-rouge mt-1" onClick={() => onChange("")}>
          Remove
        </button>
      )}
    </div>
  );
}

/** Several photos for one message: add many at once, remove any. */
function MessagePhotos({ photos, onChange }: { photos: string[]; onChange: (list: string[]) => void }) {
  const [busy, setBusy] = useState(0);
  const latest = useRef(photos);
  latest.current = photos;
  return (
    <div className="flex flex-wrap gap-2 mt-2 items-center">
      {photos.map((url, k) => (
        <div key={url + k} className="relative w-16 h-16 rounded-xl overflow-hidden group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="w-full h-full object-cover" />
          <button
            className="absolute inset-0 bg-ink/70 text-bone text-xs font-semibold opacity-0 group-hover:opacity-100 focus:opacity-100"
            onClick={() => onChange(photos.filter((_, j) => j !== k))}
          >
            Remove
          </button>
        </div>
      ))}
      <label className="w-16 h-16 rounded-xl border-2 border-dashed border-bone/25 grid place-items-center text-center text-[11px] leading-tight text-bone/55 cursor-pointer hover:border-acid">
        {busy ? `Uploading ${busy}…` : "+ Photos"}
        <input
          type="file"
          multiple
          accept="image/png,image/webp,image/jpeg"
          className="hidden"
          onChange={async (e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = "";
            if (!files.length) return;
            setBusy(files.length);
            const added: string[] = [];
            for (const f of files) {
              try {
                added.push(await uploadFile(f));
              } catch (err) {
                alert(`${f.name}: ${(err as Error).message}`);
              }
              setBusy((n) => Math.max(0, n - 1));
            }
            onChange([...latest.current, ...added]);
            setBusy(0);
          }}
        />
      </label>
      {photos.length > 0 && <span className="text-xs text-bone/45">{photos.length} photo{photos.length === 1 ? "" : "s"}</span>}
    </div>
  );
}

function MascotSection({ content, update }: { content: Content; update: Update }) {
  const [busy, setBusy] = useState(false);
  const list = content.mascots ?? [];
  return (
    <Section
      title="The cat"
      hint="Upload your own cat artwork (PNG with a transparent background looks best). It appears on the welcome, join, lobby and round screens. With nothing uploaded, the game’s own cat is used."
    >
      <div className="flex flex-wrap gap-4 items-end">
        {list.map((m, i) => (
          <div key={m.slice(-24) + i} className="w-28 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m} alt="" className="w-28 h-28 object-contain bg-wine rounded-2xl" />
            <button className="label hover:text-rouge mt-1" onClick={() => update((c) => void (c.mascots = (c.mascots ?? []).filter((_, j) => j !== i)))}>
              Remove
            </button>
          </div>
        ))}
        <label className="w-28 h-28 rounded-2xl border-2 border-dashed border-bone/25 grid place-items-center text-center text-sm text-bone/55 cursor-pointer hover:border-acid">
          {busy ? "Uploading…" : "Add artwork"}
          <input
            type="file"
            accept="image/png,image/webp,image/jpeg"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setBusy(true);
              try {
                const dataUrl = await new Promise<string>((res, rej) => {
                  const r = new FileReader();
                  r.onload = () => res(String(r.result));
                  r.onerror = rej;
                  r.readAsDataURL(f);
                });
                const { url } = await api<{ url: string }>("/api/admin/upload", { method: "POST", body: JSON.stringify({ dataUrl }) });
                update((c) => void (c.mascots = [...(c.mascots ?? []), url]));
              } catch (err) {
                alert((err as Error).message);
              }
              setBusy(false);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      <p className="text-bone/45 text-xs mt-3">With several images, different screens use different ones: the first on the welcome screen, the second in the lobby, and so on.</p>
    </Section>
  );
}

function HerLogin({ content, update }: { content: Content; update: Update }) {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const n = Object.keys(content.honoreeAnswers ?? {}).length;
  return (
    <Section
      title="Her login"
      hint="She opens this link, enters the password, and answers her questions in private before the party. Her answers stay hidden from you here, so you can play too."
    >
      <div className="grid sm:grid-cols-2 gap-6">
        <div>
          <label className="label block mb-1">Her link</label>
          <div className="flex gap-2 items-center">
            <input readOnly className="box font-mono text-sm" value={`${origin}/her`} onFocus={(e) => e.target.select()} />
            <button className="btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(`${origin}/her`)}>
              Copy
            </button>
          </div>
        </div>
        <div>
          <label className="label block mb-1">Her password</label>
          <input
            className="box"
            value={content.honoreePassword ?? ""}
            placeholder="Something only she’ll know"
            onChange={(e) => update((c) => void (c.honoreePassword = e.target.value))}
          />
        </div>
      </div>
      <p className="text-bone/50 text-sm mt-3">
        {n ? `She has answered ${n} question${n === 1 ? "" : "s"} so far.` : "She hasn’t answered anything yet."}
      </p>
    </Section>
  );
}

// ───────────────────────── Questions ─────────────────────────

const SETS: { id: QSet | "mostLikely"; label: string; hint: string; extra?: boolean }[] = [
  { id: "knowHer", label: "I · Crystal Clear?", hint: "Questions about {name}. She can give her real answers on her own page, or you type them here. Add a photo to make a picture question. Free text is auto-marked leniently and you can overrule it on the reveal." },
  { id: "past40", label: "II · The Past 40 Years", hint: "1986 to 2026, played in this order. Switch on the ones you want; the rest wait in the bank. Edit any question or add your own." },
  { id: "men", label: "III · The Men", hint: "Everyone votes for one man per question; the girl behind the most-voted man gets the points. Open a question to choose which of the three men appear. Photos and names are on the Players & portraits page." },
  { id: "finale", label: "IV · No Further Questions", hint: "A mix: Who Said That? slots (filled from the confessions), stories where the options are the girls, questions about {name}, and the final question." },
  { id: "trivia", label: "General trivia", hint: "For the optional General Trivia round. Each game picks a random set at the difficulty you choose.", extra: true },
  { id: "honoreeVs", label: "Her vs. Everyone", hint: "For the optional Her vs. Everyone round.", extra: true },
  { id: "mostLikely", label: "Most Likely To", hint: "For the optional Most Likely To round.", extra: true },
  { id: "final40", label: "The Wager", hint: "For the optional wager round (teams only).", extra: true },
  { id: "tiebreakers", label: "Tie-breakers", hint: "Numeric. Closest answer wins. Played only if the final scores are level.", extra: true },
];

function QuestionsTab({ content, update }: { content: Content; update: Update }) {
  const [set, setSet] = useState<QSet | "mostLikely">("knowHer");
  const meta = SETS.find((s) => s.id === set)!;
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-8 items-center">
        {SETS.map((s, k) => (
          <span key={s.id} className="contents">
          {s.extra && !SETS[k - 1]?.extra && <span className="label w-full mt-2">Optional extras</span>}
          <button key={s.id} onClick={() => setSet(s.id)} className={`btn-sm border ${set === s.id ? "border-acid text-acid" : "border-bone/20 text-bone/60 hover:text-bone"}`}>
            {s.label}
            <span className="font-mono text-xs ml-2 opacity-60">
              {s.id === "mostLikely" ? content.questions.mostLikely.length : (content.questions[s.id as QSet] ?? []).filter((q) => !q.off).length}
            </span>
          </button>
          </span>
        ))}
      </div>
      {set === "trivia" && (
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <span className="label mr-2">Each game uses</span>
          {(
            [
              ["mixed", "Any difficulty"],
              ["harder", "Medium and hard"],
              ["hardest", "Hard only"],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              onClick={() => update((c) => void (c.triviaLevel = v))}
              className={`btn-sm border ${(content.triviaLevel ?? "mixed") === v ? "border-acid text-acid" : "border-bone/20 text-bone/60 hover:text-bone"}`}
            >
              {l}
            </button>
          ))}
        </div>
      )}
      {set === "mostLikely" ? <MostLikelyEditor content={content} update={update} hint={meta.hint} /> : <QuestionList set={set} content={content} update={update} title={meta.label.replace(/^[IV]+ · /, "")} hint={meta.hint.replace(/\{name\}/g, content.honoree.name)} />}
    </div>
  );
}

function MostLikelyEditor({ content, update, hint }: { content: Content; update: Update; hint: string }) {
  const list = content.questions.mostLikely;
  return (
    <Section
      title="Most Likely To"
      hint={hint}
      action={
        <button className="btn-ghost btn-sm" onClick={() => update((c) => void c.questions.mostLikely.push({ id: uid(6), prompt: "Who is most likely to " }))}>
          Add
        </button>
      }
    >
      <div className="space-y-2">
        {list.map((q, i) => (
          <div key={q.id} className="flex gap-2 items-center">
            <input className="box" value={q.prompt} onChange={(e) => update((c) => void (c.questions.mostLikely[i].prompt = e.target.value))} />
            <button className="label hover:text-rouge" onClick={() => update((c) => void c.questions.mostLikely.splice(i, 1))}>
              Delete
            </button>
          </div>
        ))}
      </div>
    </Section>
  );
}

function blankQuestion(set: QSet): ContentQuestion {
  if (set === "tiebreakers") return { id: uid(6), type: "number", prompt: "", answer: 0 };
  if (set === "men") return { id: uid(6), type: "vote", prompt: "Who looks like he’d " };
  if (set === "past40") return { id: uid(6), type: "mc", prompt: "", options: ["", "", "", ""], answer: 0, difficulty: "medium", year: 2000 };
  if (set === "honoreeVs") return { id: uid(6), type: "mc", prompt: "", options: ["", "", "", ""] };
  return { id: uid(6), type: set === "knowHer" ? "text" : "mc", prompt: "", options: ["", "", "", ""], answer: set === "knowHer" ? "" : 0 };
}

function QuestionList({ set, content, update, title, hint }: { set: QSet; content: Content; update: Update; title: string; hint: string }) {
  const list = content.questions[set] ?? [];
  const [open, setOpen] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const round = content.rounds.find((r) => r.kind === (set === "tiebreakers" ? "" : set));
  const inGame = list.filter((q) => !q.off && !q.bonus).length;
  const [filter, setFilter] = useState("");
  const her = content.honoreeAnswers ?? {};
  const visible = (q: ContentQuestion) =>
    !filter || `${q.prompt} ${q.category ?? ""} ${q.difficulty ?? ""} ${(q.options ?? []).join(" ")}`.toLowerCase().includes(filter.toLowerCase());
  return (
    <Section
      title={title}
      hint={hint}
      action={
        <div className="flex gap-2">
          <button className="btn-ghost btn-sm" onClick={() => setImporting(!importing)}>
            Import
          </button>
          <button
            className="btn-ghost btn-sm"
            onClick={() => {
              const q = blankQuestion(set);
              update((c) => void (c.questions[set] = [...(c.questions[set] ?? []), q]));
              setOpen(q.id);
            }}
          >
            Add question
          </button>
        </div>
      }
    >
      {round && (
        <p className={`text-sm mb-4 ${inGame < round.count ? "text-rouge" : "text-bone/55"}`}>
          {inGame} switched on for the game · the round plays {round.count}
          {inGame > round.count ? ` (the first ${round.count} in this order)` : ""}
          {list.some((q) => q.bonus && !q.off) ? ` · plus ${list.filter((q) => q.bonus && !q.off).length} bonus` : ""}
          {list.some((q) => q.off) ? ` · ${list.filter((q) => q.off).length} in the bank` : ""}
        </p>
      )}
      {importing && (
        <ImportBox
          set={set}
          onImport={(qs) => {
            update((c) => void (c.questions[set] = [...(c.questions[set] ?? []), ...qs]));
            setImporting(false);
          }}
        />
      )}
      {list.length > 15 && (
        <input className="box mb-4" placeholder="Search questions, categories or “hard”…" value={filter} onChange={(e) => setFilter(e.target.value)} />
      )}
      <ol className="border-t border-bone/10">
        {list.map((q, i) => !visible(q) ? null : (
          <li key={q.id} className={`border-b border-bone/10 ${q.off ? "opacity-50" : ""}`}>
            <div className="flex items-baseline gap-3">
            <button
              title={q.off ? "In the bank. Click to play it." : "Playing. Click to move it to the bank."}
              className={`shrink-0 font-mono text-[10px] tracking-label px-1.5 py-0.5 border ${q.off ? "border-bone/20 text-bone/40" : "border-acid text-acid"}`}
              onClick={() => update((c) => void (c.questions[set][i].off = !q.off))}
            >
              {q.off ? "BANK" : q.bonus ? "BONUS" : "ON"}
            </button>
            <button className="flex-1 text-left flex items-baseline gap-4 py-3" onClick={() => setOpen(open === q.id ? null : q.id)}>
              <span className="font-mono text-xs text-bone/40 w-6">{i + 1}</span>
              {q.year && <span className="font-mono text-xs text-bone/50">{q.year}</span>}
              <span className="flex-1 font-serif text-xl leading-snug">
                {q.fromPool ? <em className="text-bone/60">A confession, picked at random on the night</em> : q.prompt.replace(/\{name\}/g, content.honoree.name) || <em className="text-bone/30">Untitled</em>}
              </span>
              {her[q.id] !== undefined ? <span className="label text-acid">She answered</span> : q.placeholder && <span className="label text-rouge">Placeholder</span>}
              {q.difficulty && <span className="label">{q.difficulty}</span>}
              {q.aboutHer && <span className="label">About her</span>}
              <span className="label">
                {q.fromPool ? "Who said that" : q.optionsFrom ? "The girls" : q.type === "mc" ? "Choice" : q.type === "text" ? "Free text" : q.type === "vote" ? "Vote" : q.type === "kfm" ? "K / F / M" : "Number"}
              </span>
            </button>
            </div>
            {open === q.id && (
              <QuestionEditor
                set={set}
                q={q}
                name={content.honoree.name}
                girls={content.players.map((p) => p.name)}
                onChange={(fn) => update((c) => fn(c.questions[set][i]))}
                herAnswer={her[q.id]}
                onClearHer={() => update((c) => void delete c.honoreeAnswers[q.id])}
                onDelete={() => confirm("Delete this question?") && update((c) => void c.questions[set].splice(i, 1))}
                onMove={(d) =>
                  update((c) => {
                    const arr = c.questions[set];
                    const j = i + d;
                    if (j < 0 || j >= arr.length) return;
                    [arr[i], arr[j]] = [arr[j], arr[i]];
                  })
                }
              />
            )}
          </li>
        ))}
      </ol>
      {!list.length && <p className="text-bone/40 font-serif italic text-xl mt-4">No questions yet.</p>}
    </Section>
  );
}

function QuestionEditor({
  set,
  q,
  name,
  onChange,
  onDelete,
  onMove,
  herAnswer,
  onClearHer,
  girls = [],
}: {
  girls?: string[];
  set: QSet;
  q: ContentQuestion;
  name: string;
  onChange: (fn: (q: ContentQuestion) => void) => void;
  onDelete: () => void;
  onMove: (d: number) => void;
  herAnswer?: string | number;
  onClearHer?: () => void;
}) {
  const [peek, setPeek] = useState(false);
  const types: QType[] =
    set === "tiebreakers"
      ? ["number"]
      : set === "men"
        ? ["vote", "kfm"]
        : set === "finale"
          ? ["mc", "text", "number"]
          : set === "honoreeVs" || set === "trivia" || set === "past40"
            ? ["mc"]
            : ["mc", "text"];
  const TYPE_LABEL: Record<string, string> = { mc: "Multiple choice", text: "Free text", number: "Closest number", vote: "Vote for one", kfm: "Kill / F / Marry" };
  const ch = (fn: (q: ContentQuestion) => void) =>
    onChange((x) => {
      fn(x);
      x.placeholder = false; // any edit means it's no longer the stock placeholder
    });
  return (
    <div className="pb-6 pl-10 pr-1 space-y-5 anim-fade">
      {types.length > 1 && (
        <div className="flex gap-2">
          {types.map((t) => (
            <button
              key={t}
              className={`btn-sm border ${q.type === t ? "border-acid text-acid" : "border-bone/20 text-bone/60"}`}
              onClick={() =>
                ch((x) => {
                  x.type = t;
                  if (t === "mc") {
                    x.options = x.options?.length ? x.options : ["", "", "", ""];
                    x.answer = typeof x.answer === "number" ? x.answer : 0;
                  } else if (t === "number") x.answer = typeof x.answer === "number" ? x.answer : 0;
                  else if (t === "text") x.answer = typeof x.answer === "string" ? x.answer : "";
                  else delete x.answer;
                })
              }
            >
              {TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" className="accent-acid" checked={!q.off} onChange={(e) => onChange((x) => void (x.off = !e.target.checked))} />
          Play it in the game
        </label>
        {set !== "tiebreakers" && (
          <label className="flex items-center gap-2">
            <input type="checkbox" className="accent-acid" checked={!!q.bonus} onChange={(e) => onChange((x) => void (x.bonus = e.target.checked || undefined))} />
            Bonus question (after the main ones)
          </label>
        )}
        {set === "finale" && (
          <>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="accent-acid" checked={!!q.fromPool} onChange={(e) => ch((x) => void (x.fromPool = e.target.checked || undefined, e.target.checked && ((x.optionsFrom = "players"), (x.type = "mc"))))} />
              Who Said That? slot (a random confession)
            </label>
            {!q.fromPool && q.type === "mc" && (
              <label className="flex items-center gap-2">
                <input type="checkbox" className="accent-acid" checked={q.optionsFrom === "players"} onChange={(e) => ch((x) => void (x.optionsFrom = e.target.checked ? "players" : undefined, (x.answer = e.target.checked ? "" : 0)))} />
                The options are the girls
              </label>
            )}
            {!q.fromPool && (
              <label className="flex items-center gap-2">
                <input type="checkbox" className="accent-acid" checked={!!q.askHer} onChange={(e) => ch((x) => void (x.askHer = e.target.checked || undefined))} />
                {name} answers it on her page
              </label>
            )}
          </>
        )}
      </div>

      {q.fromPool ? (
        <p className="text-bone/55 text-sm">
          On the night this slot shows one confession, chosen at random from the ones your friends sent in (Friends tab) or typed in the lobby. Everyone guesses who wrote it.
        </p>
      ) : (
      <div>
        <label className="label block mb-1">Question · use {"{name}"} for {name}</label>
        <textarea className="box min-h-[64px] font-serif text-xl" value={q.prompt} onChange={(e) => ch((x) => void (x.prompt = e.target.value))} />
      </div>
      )}

      {set === "men" && (
        <div>
          <label className="label block mb-1">Which men appear</label>
          <div className="flex flex-wrap gap-2">
            {([undefined, 0, 1, 2] as const).map((v) => (
              <button
                key={String(v)}
                className={q.manSet === v ? "btn-primary btn-sm" : "btn-ghost btn-sm"}
                onClick={() => onChange((x) => void (v === undefined ? delete x.manSet : (x.manSet = v)))}
              >
                {v === undefined ? "Rotate 1, 2, 3" : `Man ${v + 1}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {q.optionsFrom === "players" && !q.fromPool && (
        <div>
          <label className="label block mb-1">The right answer</label>
          <select className="box max-w-xs" value={String(q.answer ?? "")} onChange={(e) => ch((x) => void (x.answer = e.target.value))}>
            <option value="">Choose…</option>
            {girls.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <p className="text-bone/45 text-xs mt-1">The options are everyone’s names, set on the Players & portraits page.</p>
        </div>
      )}

      {herAnswer !== undefined && (
        <div className="border border-acid/40 px-4 py-3 text-sm flex flex-wrap items-center gap-3">
          <span className="text-acid">She answered this herself. Her answer is used in the game.</span>
          <span className="flex-1" />
          {peek ? (
            <span className="font-serif italic text-lg">{q.type === "mc" ? q.options?.[herAnswer as number] : String(herAnswer)}</span>
          ) : (
            <button className="label hover:text-bone" onClick={() => setPeek(true)}>
              Show (spoiler)
            </button>
          )}
          <button className="label hover:text-rouge" onClick={() => confirm("Clear her answer?") && onClearHer?.()}>
            Clear
          </button>
        </div>
      )}

      {q.type === "mc" && !q.optionsFrom && (
        <div>
          <label className="label block mb-2">{set === "honoreeVs" ? "Options · tick a fallback answer only if she isn’t playing" : "Options · tick the right one"}</label>
          <div className="space-y-2">
            {(q.options ?? []).map((o, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  type="radio"
                  name={`ans-${q.id}`}
                  className="accent-acid w-4 h-4"
                  checked={q.answer === i}
                  onChange={() => ch((x) => void (x.answer = i))}
                  onClick={() => set === "honoreeVs" && q.answer === i && ch((x) => void delete x.answer)}
                />
                <input className="box" value={o} onChange={(e) => ch((x) => void (x.options![i] = e.target.value))} placeholder={`Option ${i + 1}`} />
                <button
                  className="label hover:text-rouge"
                  onClick={() =>
                    ch((x) => {
                      x.options!.splice(i, 1);
                      if (typeof x.answer === "number" && x.answer >= x.options!.length) x.answer = 0;
                    })
                  }
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          {(q.options?.length ?? 0) < 6 && (
            <button className="label mt-2 hover:text-bone" onClick={() => ch((x) => void (x.options = [...(x.options ?? []), ""]))}>
              + Option
            </button>
          )}
        </div>
      )}

      {q.type === "text" && (
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label block mb-1">Her real answer</label>
            <input className="box" value={String(q.answer ?? "")} onChange={(e) => ch((x) => void (x.answer = e.target.value))} />
          </div>
          <div>
            <label className="label block mb-1">Also accept (comma separated)</label>
            <input
              className="box"
              value={(q.accept ?? []).join(", ")}
              onChange={(e) => ch((x) => void (x.accept = e.target.value.split(",").map((s) => s.trim()).filter(Boolean)))}
            />
          </div>
        </div>
      )}

      {q.type === "number" && (
        <div className="flex gap-4 flex-wrap">
          <div>
            <label className="label block mb-1">Correct number</label>
            <input type="number" className="box w-40" value={Number(q.answer ?? 0)} onChange={(e) => ch((x) => void (x.answer = Number(e.target.value)))} />
          </div>
          {set === "finale" && (
            <div>
              <label className="label block mb-1">Points for the closest</label>
              <input type="number" className="box w-40" value={q.points ?? 100} onChange={(e) => ch((x) => void (x.points = Number(e.target.value)))} />
            </div>
          )}
        </div>
      )}

      {set !== "men" && <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="label block mb-1">Line shown on the reveal (optional)</label>
          <input className="box" value={q.note ?? ""} onChange={(e) => ch((x) => void (x.note = e.target.value || undefined))} />
        </div>
        {set === "past40" && (
          <div className="flex gap-3">
            <div>
              <label className="label block mb-1">Year</label>
              <input type="number" className="box w-28" value={q.year ?? ""} onChange={(e) => ch((x) => void (x.year = Number(e.target.value) || undefined))} />
            </div>
            <div>
              <label className="label block mb-1">Difficulty</label>
              <select className="box" value={q.difficulty ?? "medium"} onChange={(e) => ch((x) => void (x.difficulty = e.target.value as ContentQuestion["difficulty"]))}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>
        )}
        {set === "trivia" && (
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="label block mb-1">Category</label>
              <input className="box" value={q.category ?? ""} onChange={(e) => ch((x) => void (x.category = e.target.value))} />
            </div>
            <div>
              <label className="label block mb-1">Difficulty</label>
              <select className="box" value={q.difficulty ?? "medium"} onChange={(e) => ch((x) => void (x.difficulty = e.target.value as ContentQuestion["difficulty"]))}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>
        )}
        {set === "final40" && (
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="label block mb-1">Category (teased before the wager)</label>
              <input className="box" value={q.category ?? ""} onChange={(e) => ch((x) => void (x.category = e.target.value))} />
            </div>
            <label className="flex items-center gap-2 text-sm pb-2.5">
              <input type="checkbox" className="accent-acid" checked={!!q.aboutHer} onChange={(e) => ch((x) => void (x.aboutHer = e.target.checked))} />
              About her
            </label>
          </div>
        )}
      </div>}

      {(set === "knowHer" || set === "final40" || set === "trivia" || set === "past40" || (set === "finale" && !q.fromPool)) && (
        <div>
          <label className="label block mb-2">Picture (optional)</label>
          <div className="flex items-center gap-3">
            {q.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={q.image} alt="" className="h-24 w-24 object-cover" />
            )}
            <label className="btn-ghost btn-sm cursor-pointer">
              {q.image ? "Replace" : "Upload"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    const dataUrl = await resizeImage(f, 1200);
                    const { url } = await api<{ url: string }>("/api/admin/upload", { method: "POST", body: JSON.stringify({ dataUrl }) });
                    ch((x) => void (x.image = url));
                  } catch (err) {
                    alert((err as Error).message);
                  }
                }}
              />
            </label>
            {"image" in q && (
              <button className="label hover:text-rouge" onClick={() => ch((x) => void delete x.image)}>
                {q.image ? "Remove picture" : "Not a picture question"}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-4 pt-2">
        <button className="label hover:text-bone" onClick={() => onMove(-1)}>
          Move up
        </button>
        <button className="label hover:text-bone" onClick={() => onMove(1)}>
          Move down
        </button>
        <span className="flex-1" />
        <button className="label text-rouge/80 hover:text-rouge" onClick={onDelete}>
          Delete question
        </button>
      </div>
    </div>
  );
}

// ───────────────────────── Friends ─────────────────────────

function FriendsTab({ content, update }: { content: Content; update: Update }) {
  return (
    <div>
      <Section
        title="The guest list"
        hint="Names that appear as options in Who Said That?, alongside everyone who joins. Use the same names your friends will join with."
      >
        <textarea
          className="box min-h-[80px]"
          value={content.guests.join(", ")}
          placeholder="Anna, Bea, Clara…"
          onChange={(e) => update((c) => void (c.guests = e.target.value.split(",").map((s) => s.trim()).filter(Boolean)))}
        />
      </Section>

      <Section
        title="Confessions"
        hint="For Who Said That? Collected from /confess, typed in here, or added by players in the lobby on the night."
        action={
          <button className="btn-ghost btn-sm" onClick={() => update((c) => void c.confessions.unshift({ id: uid(8), author: "", text: "" }))}>
            Add
          </button>
        }
      >
        <div className="space-y-3">
          {content.confessions.map((x, i) => (
            <div key={x.id} className="grid grid-cols-[8rem_1fr_auto] gap-2 items-start">
              <input className="box" placeholder="Who" value={x.author} onChange={(e) => update((c) => void (c.confessions[i].author = e.target.value))} />
              <textarea className="box min-h-[44px]" placeholder="What she said" value={x.text} onChange={(e) => update((c) => void (c.confessions[i].text = e.target.value))} />
              <button className="label hover:text-rouge pt-3" onClick={() => update((c) => void c.confessions.splice(i, 1))}>
                Delete
              </button>
            </div>
          ))}
          {!content.confessions.length && <p className="text-bone/40 font-serif italic text-xl">The vault is empty.</p>}
        </div>
      </Section>

      <Section
        title="Messages for her"
        hint="Played as a slideshow from the final screen, one message at a time. One slide per message, with all its photos beside the words. Select several photos at once. Without any, her photos fill in."
        action={
          <button className="btn-ghost btn-sm" onClick={() => update((c) => void c.messages.push({ id: uid(8), from: "", text: "" }))}>
            Add
          </button>
        }
      >
        <div className="space-y-3">
          {content.messages.map((x, i) => (
            <div key={x.id} className="grid grid-cols-[8rem_1fr_auto] gap-2 items-start border-b border-bone/10 pb-3">
              <input className="box" placeholder="From" value={x.from} onChange={(e) => update((c) => void (c.messages[i].from = e.target.value))} />
              <div>
                <textarea className="box min-h-[80px] w-full" placeholder="The message" value={x.text} onChange={(e) => update((c) => void (c.messages[i].text = e.target.value))} />
                <MessagePhotos
                  photos={[...(x.photo ? [x.photo] : []), ...(x.photos ?? [])]}
                  onChange={(list) =>
                    update((c) => {
                      c.messages[i].photo = undefined;
                      c.messages[i].photos = list;
                    })
                  }
                />
              </div>
              <button className="label hover:text-rouge pt-3" onClick={() => update((c) => void c.messages.splice(i, 1))}>
                Delete
              </button>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ───────────────────────── Rounds ─────────────────────────

const KIND_LABEL: Record<RoundKind, string> = {
  knowHer: "Her trivia",
  past40: "Four decades, in order",
  men: "Men’s lineup vote",
  finale: "Confessions, stories and the last question",
  trivia: "General trivia",
  whoSaid: "Confessions",
  mostLikely: "Anonymous vote",
  honoreeVs: "She answers, they predict",
  final40: "Wagers",
};

function RoundsTab({ content, update }: { content: Content; update: Update }) {
  return (
    <div>
      <Section
        title="Rounds"
        hint={`The default game is four rounds of ten: ${content.rounds.filter((r) => r.enabled).reduce((n, r) => n + r.count, 0)} questions with the current settings, plus any bonus questions. Optional rounds sit below, switched off. Timer 0 means no clock: the host closes each question.`}
      >
        <div className="space-y-4">
          {content.rounds.map((r, i) => (
            <div key={r.kind} className={`border border-bone/15 p-4 ${r.enabled ? "" : "opacity-50"}`}>
              <div className="flex items-center gap-3 mb-3">
                <input type="checkbox" className="accent-acid w-4 h-4" checked={r.enabled} onChange={(e) => update((c) => void (c.rounds[i].enabled = e.target.checked))} />
                <span className="label">{KIND_LABEL[r.kind]}</span>
                <span className="flex-1" />
                <button className="label hover:text-bone" disabled={i === 0} onClick={() => update((c) => void ([c.rounds[i - 1], c.rounds[i]] = [c.rounds[i], c.rounds[i - 1]]))}>
                  Up
                </button>
                <button className="label hover:text-bone" disabled={i === content.rounds.length - 1} onClick={() => update((c) => void ([c.rounds[i + 1], c.rounds[i]] = [c.rounds[i], c.rounds[i + 1]]))}>
                  Down
                </button>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <input className="box font-serif text-xl" value={r.title} onChange={(e) => update((c) => void (c.rounds[i].title = e.target.value))} />
                <input className="box" value={r.subtitle} onChange={(e) => update((c) => void (c.rounds[i].subtitle = e.target.value))} />
              </div>
              <div className="grid grid-cols-3 gap-3 mt-3">
                <Num label="Questions" value={r.count} onChange={(v) => update((c) => void (c.rounds[i].count = v))} />
                <Num label="Timer (sec)" value={r.timerSec} onChange={(v) => update((c) => void (c.rounds[i].timerSec = v))} />
                {r.kind === "men" ? (
                  <p className="text-xs text-bone/50 self-end pb-2">Points for this round are set under Scoring below.</p>
                ) : (
                  <Num label={r.kind === "final40" ? "Points (wagers decide)" : r.kind === "mostLikely" ? "Points for siding with the room" : "Points per right answer"} value={r.points} onChange={(v) => update((c) => void (c.rounds[i].points = v))} />
                )}
              </div>
              <label className="flex items-center gap-2 text-sm mt-3">
                <input type="checkbox" className="accent-acid" checked={!!r.includeBonus} onChange={(e) => update((c) => void (c.rounds[i].includeBonus = e.target.checked))} />
                Play this round’s bonus questions after the main {r.count}
              </label>
            </div>
          ))}
        </div>
      </Section>

      <Section title="How the game is scored">
        <div className="space-y-3 mb-8">
          <Toggle
            on={content.scoring.hideScoresUntilEnd}
            set={(v) => update((c) => void (c.scoring.hideScoresUntilEnd = v))}
            label="Keep scores sealed until the final reveal"
            hint="Answers are revealed after every question, but nobody sees points or standings until the end."
          />
          <Toggle
            on={content.scoring.autoReveal}
            set={(v) => update((c) => void (c.scoring.autoReveal = v))}
            label="Reveal automatically once everyone has answered"
            hint="Off: the host taps to reveal each answer. Men’s voting always waits for the host."
          />
          <Toggle
            on={content.teamsEnabled}
            set={(v) => update((c) => void (c.teamsEnabled = v))}
            label="Play in teams"
            hint="Off: everyone plays for herself (best for six). On: two teams, named below."
          />
        </div>

        <p className="label mb-2">Round III · The Men of Questionable Taste</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {(
            [
              ["The girl behind the winner scores", 100, 0],
              ["Everyone who votes scores", 0, 25],
              ["Both", 100, 25],
              ["Just for fun", 0, 0],
            ] as const
          ).map(([label, w, part]) => (
            <button
              key={label}
              onClick={() => update((c) => void ((c.scoring.menWinner = w), (c.scoring.menParticipation = part)))}
              className={`btn-sm border ${content.scoring.menWinner === w && content.scoring.menParticipation === part ? "border-acid text-acid" : "border-bone/20 text-bone/60 hover:text-bone"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          <Num label="Points for the girl behind the most-voted man" value={content.scoring.menWinner} onChange={(v) => update((c) => void (c.scoring.menWinner = v))} />
          <Num label="Participation points per vote" value={content.scoring.menParticipation} onChange={(v) => update((c) => void (c.scoring.menParticipation = v))} />
        </div>

        <p className="label mb-2">Other rounds</p>
        <div className="grid sm:grid-cols-3 gap-4">
          <Num label="Trivia speed bonus (max)" value={content.scoring.speedBonus} onChange={(v) => update((c) => void (c.scoring.speedBonus = v))} />
          <Num label="Surprise multiplier (Her vs. Everyone)" value={content.scoring.surpriseMultiplier} onChange={(v) => update((c) => void (c.scoring.surpriseMultiplier = v))} />
          <Num label="Minimum wager ceiling (Final 40)" value={content.scoring.wagerFloor} onChange={(v) => update((c) => void (c.scoring.wagerFloor = v))} />
        </div>
        <p className="text-bone/40 text-sm mt-3">
          Trivia: medium questions are worth 1.5×, hard 2×. A surprise bonus applies when a third or fewer guess her answer. Teams can always wager up to their score, or the ceiling, whichever is higher.
        </p>
      </Section>

      <EncoreSection content={content} update={update} />

      {content.teamsEnabled && <Section title="Teams">
        <div className="grid sm:grid-cols-2 gap-4">
          {content.teams.map((t, i) => (
            <input key={t.id} className="field font-serif text-3xl" value={t.name} onChange={(e) => update((c) => void (c.teams[i].name = e.target.value))} />
          ))}
        </div>
      </Section>}
    </div>
  );
}

const ENCORE_KINDS: RoundKind[] = ["trivia", "past40", "knowHer", "mostLikely", "whoSaid", "men", "finale"];

function EncoreSection({ content, update }: { content: Content; update: Update }) {
  const e = { ...ENCORE_DEFAULT, ...(content.encore ?? {}) };
  const set = (fn: (x: Encore) => void) =>
    update((c) => {
      c.encore = { ...ENCORE_DEFAULT, ...(c.encore ?? {}) };
      fn(c.encore);
    });
  return (
    <Section
      title="After the winner"
      hint="Extras for the final screen. Each one switched on here gets a button in the host controls once the winner is announced. Everyone’s scores always show on that screen."
    >
      <div className="space-y-5">
        <div className="flex gap-5 items-start">
          <ImageSlot url={e.image} label="Add a picture" className="w-32 h-40" onChange={(url) => set((x) => void (x.image = url))} />
          <p className="text-sm text-bone/60 pt-2">
            A picture for the final screen, next to the winner. It also opens the slideshow.
            <span className="block text-bone/40 mt-1">Without one, the cat sits there instead.</span>
          </p>
        </div>

        <Toggle
          on={e.slideshow}
          set={(v) => set((x) => void (x.slideshow = v))}
          label={`Messages slideshow for ${content.honoree.name}`}
          hint={`Your friends’ messages, one at a time, full screen. ${content.messages.length} written so far, in the Friends tab.`}
        />
        {e.slideshow && (
          <div className="ml-7 max-w-[12rem]">
            <Num label="Seconds per slide" value={e.slideSeconds} onChange={(v) => set((x) => void (x.slideSeconds = Math.max(3, v)))} />
          </div>
        )}

        <Toggle
          on={e.tiebreaker}
          set={(v) => set((x) => void (x.tiebreaker = v))}
          label="Tie-breaker button"
          hint={`Always on offer, not only when two are level. Closest guess wins 10 points. ${content.questions.tiebreakers.filter((q) => q.prompt.trim()).length} tie-breaker questions ready, in Questions.`}
        />

        <Toggle
          on={e.extraRound}
          set={(v) => set((x) => void (x.extraRound = v))}
          label="Extra round"
          hint="One more round after the winner, if the night isn’t over. It only uses questions nobody has seen tonight, including ones switched off in the bank. Points add to the totals."
        />
        {e.extraRound && (
          <div className="ml-7 grid sm:grid-cols-3 gap-3">
            <label className="block">
              <span className="label block mb-1 normal-case tracking-normal text-[12px] font-sans">Questions from</span>
              <select className="box" value={e.extraKind} onChange={(ev) => set((x) => void (x.extraKind = ev.target.value as RoundKind))}>
                {ENCORE_KINDS.filter((k) => content.rounds.some((r) => r.kind === k)).map((k) => (
                  <option key={k} value={k}>
                    {content.rounds.find((r) => r.kind === k)!.title.replace("{name}", content.honoree.name)} · {KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label block mb-1 normal-case tracking-normal text-[12px] font-sans">Title on screen</span>
              <input className="box" value={e.extraTitle} onChange={(ev) => set((x) => void (x.extraTitle = ev.target.value))} />
            </label>
            <Num label="Questions" value={e.extraCount} onChange={(v) => set((x) => void (x.extraCount = Math.max(1, v)))} />
          </div>
        )}
      </div>
    </Section>
  );
}

function Toggle({ on, set, label, hint }: { on: boolean; set: (v: boolean) => void; label: string; hint: string }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input type="checkbox" className="accent-acid w-4 h-4 mt-1" checked={!!on} onChange={(e) => set(e.target.checked)} />
      <span>
        {label}
        <span className="block text-bone/45 text-sm">{hint}</span>
      </span>
    </label>
  );
}

function Num({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="label block mb-1 normal-case tracking-normal text-[12px] font-sans">{label}</span>
      <input type="number" min={0} className="box" value={value} onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))} />
    </label>
  );
}
