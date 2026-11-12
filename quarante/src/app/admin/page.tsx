"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, hostKey, resizeImage, store } from "@/lib/client";
import { Wordmark } from "@/components/ui";
import { DEFAULT_CONTENT } from "@/lib/defaultContent";
import { uid } from "@/lib/engine";
import type { Content, ContentQuestion, QType, RoundKind } from "@/lib/types";

type Tab = "her" | "rounds" | "questions" | "friends" | "play";
type QSet = "knowHer" | "honoreeVs" | "final40" | "trivia" | "tiebreakers";

const TABS: { id: Tab; label: string }[] = [
  { id: "play", label: "Play" },
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

      <nav className="flex gap-1 overflow-x-auto border-b border-bone/15 mb-8 -mx-5 px-5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-3 text-[15px] whitespace-nowrap border-b-2 -mb-px transition ${tab === t.id ? "border-acid text-bone" : "border-transparent text-bone/50 hover:text-bone"}`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "play" && <PlayTab content={content} setContent={setContent} saveState={saveState} />}
      {tab === "her" && <HerTab content={content} update={update} />}
      {tab === "questions" && <QuestionsTab content={content} update={update} />}
      {tab === "friends" && <FriendsTab content={content} update={update} />}
      {tab === "rounds" && <RoundsTab content={content} update={update} />}
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

  const placeholders = [...content.questions.knowHer, ...content.questions.final40].filter((q) => q.placeholder).length;
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

// ───────────────────────── Questions ─────────────────────────

const SETS: { id: QSet | "mostLikely"; label: string; hint: string }[] = [
  { id: "knowHer", label: "How Well Do You Know Her?", hint: "You enter her real answers here. Free-text answers are auto-marked leniently; the host can overrule on the reveal. Add a photo to make it a picture question." },
  { id: "honoreeVs", label: "Her vs. Everyone", hint: "She answers live on her phone; everyone else predicts. Set a fallback answer only if she won’t be playing on a phone." },
  { id: "final40", label: "The Final 40", hint: "Teams wager before each. Mark questions about her life so she sits those out." },
  { id: "mostLikely", label: "Most Likely To", hint: "Everyone votes for a player, anonymously." },
  { id: "trivia", label: "Your trivia", hint: "Added to the built-in bank of 105. Yours are always used first." },
  { id: "tiebreakers", label: "Tie-breakers", hint: "Numeric questions. Closest answer wins it for her team." },
];

function QuestionsTab({ content, update }: { content: Content; update: Update }) {
  const [set, setSet] = useState<QSet | "mostLikely">("knowHer");
  const meta = SETS.find((s) => s.id === set)!;
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-8">
        {SETS.map((s) => (
          <button key={s.id} onClick={() => setSet(s.id)} className={`btn-sm border ${set === s.id ? "border-acid text-acid" : "border-bone/20 text-bone/60 hover:text-bone"}`}>
            {s.label}
            <span className="font-mono text-xs ml-2 opacity-60">
              {s.id === "mostLikely" ? content.questions.mostLikely.length : content.questions[s.id as QSet].length}
            </span>
          </button>
        ))}
      </div>
      {set === "trivia" && (
        <label className="flex items-center gap-3 mb-6 text-sm">
          <input type="checkbox" className="accent-acid w-4 h-4" checked={content.useBuiltInTrivia} onChange={(e) => update((c) => void (c.useBuiltInTrivia = e.target.checked))} />
          Use the built-in bank (105 questions: 90s &amp; 00s, music, fashion, film &amp; TV, celebrity, geography, general knowledge, food &amp; drink)
        </label>
      )}
      {set === "mostLikely" ? <MostLikelyEditor content={content} update={update} hint={meta.hint} /> : <QuestionList set={set} content={content} update={update} title={meta.label} hint={meta.hint} />}
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
  if (set === "honoreeVs") return { id: uid(6), type: "mc", prompt: "", options: ["", "", "", ""] };
  return { id: uid(6), type: set === "knowHer" ? "text" : "mc", prompt: "", options: ["", "", "", ""], answer: set === "knowHer" ? "" : 0 };
}

function QuestionList({ set, content, update, title, hint }: { set: QSet; content: Content; update: Update; title: string; hint: string }) {
  const list = content.questions[set];
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Section
      title={title}
      hint={hint}
      action={
        <button
          className="btn-ghost btn-sm"
          onClick={() => {
            const q = blankQuestion(set);
            update((c) => void c.questions[set].push(q));
            setOpen(q.id);
          }}
        >
          Add question
        </button>
      }
    >
      <ol className="border-t border-bone/10">
        {list.map((q, i) => (
          <li key={q.id} className="border-b border-bone/10">
            <button className="w-full text-left flex items-baseline gap-4 py-3" onClick={() => setOpen(open === q.id ? null : q.id)}>
              <span className="font-mono text-xs text-bone/40 w-6">{i + 1}</span>
              <span className="flex-1 font-serif text-xl leading-snug">{q.prompt.replace(/\{name\}/g, content.honoree.name) || <em className="text-bone/30">Untitled</em>}</span>
              {q.placeholder && <span className="label text-rouge">Placeholder</span>}
              {q.aboutHer && <span className="label">About her</span>}
              <span className="label">{q.type === "mc" ? "Choice" : q.type === "text" ? "Free text" : "Number"}</span>
            </button>
            {open === q.id && (
              <QuestionEditor
                set={set}
                q={q}
                name={content.honoree.name}
                onChange={(fn) => update((c) => fn(c.questions[set][i]))}
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
}: {
  set: QSet;
  q: ContentQuestion;
  name: string;
  onChange: (fn: (q: ContentQuestion) => void) => void;
  onDelete: () => void;
  onMove: (d: number) => void;
}) {
  const types: QType[] = set === "tiebreakers" ? ["number"] : set === "honoreeVs" || set === "trivia" ? ["mc"] : ["mc", "text"];
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
                  } else x.answer = typeof x.answer === "string" ? x.answer : "";
                })
              }
            >
              {t === "mc" ? "Multiple choice" : "Free text"}
            </button>
          ))}
        </div>
      )}
      <div>
        <label className="label block mb-1">Question · use {"{name}"} for {name}</label>
        <textarea className="box min-h-[64px] font-serif text-xl" value={q.prompt} onChange={(e) => ch((x) => void (x.prompt = e.target.value))} />
      </div>

      {q.type === "mc" && (
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
        <div>
          <label className="label block mb-1">Correct number</label>
          <input type="number" className="box w-40" value={Number(q.answer ?? 0)} onChange={(e) => ch((x) => void (x.answer = Number(e.target.value)))} />
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="label block mb-1">Line shown on the reveal (optional)</label>
          <input className="box" value={q.note ?? ""} onChange={(e) => ch((x) => void (x.note = e.target.value || undefined))} />
        </div>
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
      </div>

      {(set === "knowHer" || set === "final40" || set === "trivia") && (
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
        hint="Shown slowly, one at a time, on the final screen."
        action={
          <button className="btn-ghost btn-sm" onClick={() => update((c) => void c.messages.push({ id: uid(8), from: "", text: "" }))}>
            Add
          </button>
        }
      >
        <div className="space-y-3">
          {content.messages.map((x, i) => (
            <div key={x.id} className="grid grid-cols-[8rem_1fr_auto] gap-2 items-start">
              <input className="box" placeholder="From" value={x.from} onChange={(e) => update((c) => void (c.messages[i].from = e.target.value))} />
              <textarea className="box min-h-[64px]" value={x.text} onChange={(e) => update((c) => void (c.messages[i].text = e.target.value))} />
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
  trivia: "General trivia",
  whoSaid: "Confessions",
  mostLikely: "Anonymous vote",
  honoreeVs: "She answers, they predict",
  final40: "Wagers",
};

function RoundsTab({ content, update }: { content: Content; update: Update }) {
  return (
    <div>
      <Section title="Rounds" hint="Turn rounds on or off, reorder them, and set counts, timers and points. Timer 0 means the host reveals manually.">
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
                <Num label={r.kind === "final40" ? "Points (wagers decide)" : r.kind === "mostLikely" ? "Points for siding with the room" : "Points per right answer"} value={r.points} onChange={(v) => update((c) => void (c.rounds[i].points = v))} />
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Scoring">
        <div className="grid sm:grid-cols-3 gap-4">
          <Num label="Trivia speed bonus (max)" value={content.scoring.speedBonus} onChange={(v) => update((c) => void (c.scoring.speedBonus = v))} />
          <Num label="Surprise multiplier (Her vs. Everyone)" value={content.scoring.surpriseMultiplier} onChange={(v) => update((c) => void (c.scoring.surpriseMultiplier = v))} />
          <Num label="Minimum wager ceiling (Final 40)" value={content.scoring.wagerFloor} onChange={(v) => update((c) => void (c.scoring.wagerFloor = v))} />
        </div>
        <p className="text-bone/40 text-sm mt-3">
          Trivia: medium questions are worth 1.5×, hard 2×. A surprise bonus applies when a third or fewer guess her answer. Teams can always wager up to their score, or the ceiling, whichever is higher.
        </p>
      </Section>

      <Section title="Teams">
        <div className="grid sm:grid-cols-2 gap-4">
          {content.teams.map((t, i) => (
            <input key={t.id} className="field font-serif text-3xl" value={t.name} onChange={(e) => update((c) => void (c.teams[i].name = e.target.value))} />
          ))}
        </div>
      </Section>
    </div>
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
