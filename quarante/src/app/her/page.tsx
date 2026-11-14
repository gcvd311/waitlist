"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, LETTERS } from "@/lib/client";
import { Wordmark } from "@/components/ui";

type Q = { id: string; set: "honoreeVs" | "knowHer" | "final40" | "finale"; type: "mc" | "text" | "number"; prompt: string; options: string[]; image?: string };
type State = { authed: boolean; name: string; configured?: boolean; questions?: Q[]; answers?: Record<string, string | number> };

const GROUPS: { set: Q["set"]; title: string; hint: string }[] = [
  { set: "knowHer", title: "Crystal Clear?", hint: "Your real answers. Your friends will be checked against them." },
  { set: "finale", title: "No Further Questions", hint: "A few for the last round." },
];

export default function HerPage() {
  const [s, setS] = useState<State | null>(null);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const load = () => api<State>("/api/her").then(setS).catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);

  async function save(id: string, value: string | number | null) {
    setSaving(id);
    setS((x) => {
      if (!x) return x;
      const answers = { ...(x.answers ?? {}) };
      if (value === null || value === "") delete answers[id];
      else answers[id] = value;
      return { ...x, answers };
    });
    try {
      await api("/api/her", { method: "PUT", body: JSON.stringify({ id, value }) });
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    }
    setSaving(null);
  }

  async function saveOptions(id: string, options: string[]) {
    setSaving(id);
    setS((x) => {
      if (!x) return x;
      const answers = { ...(x.answers ?? {}) };
      const mine = answers[id];
      if (typeof mine === "number" && mine >= options.length) delete answers[id];
      return { ...x, answers, questions: (x.questions ?? []).map((q) => (q.id === id ? { ...q, options } : q)) };
    });
    try {
      await api("/api/her", { method: "PUT", body: JSON.stringify({ id, options }) });
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    }
    setSaving(null);
  }

  if (!s) return <main className="min-h-[100dvh] grid place-items-center label anim-pulse">One moment…</main>;

  if (!s.authed)
    return (
      <main className="min-h-[100dvh] px-6 py-10 max-w-sm mx-auto flex flex-col justify-center">
        <Link href="/">
          <Wordmark className="text-2xl" />
        </Link>
        <p className="label mt-12 mb-3">For the birthday girl only</p>
        <h1 className="display text-5xl">
          Hello, <span className="italic">{s.name}.</span>
        </h1>
        <p className="mt-4 text-bone/60">Answer a few questions before the party. Nobody else sees what you write.</p>
        {s.configured === false ? (
          <p className="mt-10 text-bone/70">The host hasn’t set your password yet. Ask her for it.</p>
        ) : (
          <form
            className="mt-10 space-y-6"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api("/api/her", { method: "POST", body: JSON.stringify({ password: pw }) });
                load();
              } catch (e) {
                setErr((e as Error).message);
              }
            }}
          >
            <input type="password" className="field" placeholder="Your password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
            {err && <p className="text-rouge text-sm">{err}</p>}
            <button className="btn-acid w-full py-4">Come in</button>
          </form>
        )}
      </main>
    );

  const qs = s.questions ?? [];
  const answers = s.answers ?? {};
  const done = qs.filter((q) => answers[q.id] !== undefined).length;

  return (
    <main className="min-h-[100dvh] px-5 pt-6 pb-24 max-w-xl mx-auto">
      <header className="flex justify-between items-baseline">
        <Wordmark className="text-2xl" />
        <span className="label">
          {done} of {qs.length} answered
        </span>
      </header>
      <h1 className="display text-5xl mt-12 anim-rise">
        Your answers, <span className="italic">in confidence.</span>
      </h1>
      <p className="mt-4 text-bone/60 leading-relaxed anim-rise delay-1">
        Everything saves as you go. Come back and change anything until the party starts. During the game, your friends try to guess these.
      </p>
      {err && <p className="text-rouge text-sm mt-4">{err}</p>}

      {GROUPS.map((g) => {
        const list = qs.filter((q) => q.set === g.set);
        if (!list.length) return null;
        return (
          <section key={g.set} className="card mt-10 px-5 py-6">
            <h2 className="display text-3xl">{g.title}</h2>
            <p className="text-bone/50 text-sm mt-1 mb-6">{g.hint}</p>
            <ol className="space-y-10">
              {list.map((q) => (
                <li key={q.id}>
                  <p className="font-serif text-2xl leading-snug mb-3">{q.prompt}</p>
                  {q.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={q.image} alt="" className="w-full max-h-64 object-cover mb-3" />
                  )}
                  {q.type === "mc" ? (
                    <ChoiceEditor
                      q={q}
                      answer={answers[q.id]}
                      onPick={(i) => save(q.id, answers[q.id] === i ? null : i)}
                      onOptions={(opts) => saveOptions(q.id, opts)}
                    />
                  ) : (
                    <TextAnswer value={answers[q.id] === undefined ? "" : String(answers[q.id])} onSave={(v) => save(q.id, v)} />
                  )}
                  <p className="label mt-2 h-4">{saving === q.id ? "Saving…" : answers[q.id] !== undefined ? "Saved" : ""}</p>
                </li>
              ))}
            </ol>
          </section>
        );
      })}
      {!qs.length && <p className="mt-12 font-serif italic text-2xl text-bone/50">No questions for you yet. The host is still writing them.</p>}
    </main>
  );
}

function TextAnswer({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <input
      className="field"
      value={v}
      maxLength={140}
      placeholder="Your answer"
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v.trim() !== value && onSave(v.trim())}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}

/** Her own answer choices: edit any of them, add or remove, and tap the letter to mark her answer. */
function ChoiceEditor({
  q,
  answer,
  onPick,
  onOptions,
}: {
  q: Q;
  answer: string | number | undefined;
  onPick: (i: number) => void;
  onOptions: (opts: string[]) => void;
}) {
  const [opts, setOpts] = useState<string[]>(q.options);
  useEffect(() => setOpts(q.options), [q.options]);
  const commit = (next: string[]) => {
    if (JSON.stringify(next) !== JSON.stringify(q.options)) onOptions(next);
  };
  return (
    <div className="space-y-2">
      <p className="text-xs text-bone/55">Edit the choices if you like. Tap a letter to mark your real answer.</p>
      {opts.map((o, i) => {
        const active = answer === i;
        return (
          <div key={i} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPick(i)}
              aria-label={`Choose ${LETTERS[i]}`}
              className={`grid place-items-center w-10 h-10 shrink-0 rounded-full font-mono text-lg font-semibold transition ${
                active ? "bg-acid text-ink ring-4 ring-acid/25" : "bg-wine text-bone/60 hover:text-bone"
              }`}
            >
              {active ? "✓" : LETTERS[i]}
            </button>
            <input
              className={`box rounded-full ${active ? "border-acid border-2 font-semibold" : ""}`}
              value={o}
              maxLength={80}
              placeholder={`Choice ${LETTERS[i]}`}
              onChange={(e) => setOpts(opts.map((x, j) => (j === i ? e.target.value : x)))}
              onBlur={() => commit(opts)}
            />
            {opts.length > 2 && (
              <button
                type="button"
                className="label hover:text-rouge px-1"
                aria-label="Remove this choice"
                onClick={() => {
                  const next = opts.filter((_, j) => j !== i);
                  setOpts(next);
                  commit(next);
                }}
              >
                ×
              </button>
            )}
          </div>
        );
      })}
      {opts.length < 6 && (
        <button type="button" className="label hover:text-bone mt-1" onClick={() => setOpts([...opts, ""])}>
          + Add a choice
        </button>
      )}
    </div>
  );
}
