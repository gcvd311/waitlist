"use client";
import { useState } from "react";
import { api } from "@/lib/client";
import { uid } from "@/lib/engine";
import type { Content, ContentQuestion, Profile } from "@/lib/types";
import { Cropper, Portrait } from "./ui";

type Update = (fn: (c: Content) => void) => void;
const MAX_PLAYERS = 10;

async function upload(dataUrl: string): Promise<string> {
  const { url } = await api<{ url: string }>("/api/admin/upload", { method: "POST", body: JSON.stringify({ dataUrl }) });
  return url;
}

/** Pick a file, crop it to the shared 4:5 frame, upload, hand back the URL. */
function useCropUpload() {
  const [job, setJob] = useState<{ file: File; done: (url: string) => void } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pick = (done: (url: string) => void) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const f = input.files?.[0];
      if (f) setJob({ file: f, done });
    };
    input.click();
  };
  const ui = (
    <>
      {job && (
        <Cropper
          file={job.file}
          onCancel={() => setJob(null)}
          onDone={async (dataUrl) => {
            const j = job;
            setJob(null);
            setBusy(true);
            setError(null);
            try {
              j.done(await upload(dataUrl));
            } catch (e) {
              setError((e as Error).message);
            }
            setBusy(false);
          }}
        />
      )}
      {busy && <p className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-bone text-ink px-4 py-2 text-sm">Uploading…</p>}
      {error && <p className="text-rouge text-sm mb-4">{error}</p>}
    </>
  );
  return { pick, ui };
}

export function PlayersTab({ content, update }: { content: Content; update: Update }) {
  const { pick, ui } = useCropUpload();
  const [preview, setPreview] = useState(false);
  const players = content.players ?? [];
  const set = (i: number, fn: (p: Profile) => void) => update((c) => fn(c.players[i]));

  return (
    <div>
      {ui}
      <section className="mb-10">
        <h2 className="display text-3xl">The girls, and the men they become</h2>
        <p className="text-bone/55 text-sm mt-1 max-w-2xl">
          Each card is one player. On the left, her real portrait: players tap it to join. On the right, her man for Round 3: his
          fictional name and his portraits. Who is behind each man stays on the server until the unmasking.
        </p>
      </section>

      <div className="grid lg:grid-cols-2 gap-6">
        {players.map((p, i) => (
          <article key={p.id} className="border border-bone/15 p-4">
            <div className="flex items-center justify-between mb-4">
              <span className="font-mono text-xs text-bone/40">Player {i + 1}</span>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="honoree"
                  className="accent-acid"
                  checked={!!p.honoree}
                  onChange={() => update((c) => c.players.forEach((x, j) => (x.honoree = j === i)))}
                />
                Birthday girl
              </label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="label mb-2 text-sage">Her · real portrait</p>
                <Portrait photo={p.photo} name={p.name} />
                <div className="flex gap-3 mt-2">
                  <button className="label hover:text-bone" onClick={() => pick((url) => set(i, (x) => void (x.photo = url)))}>
                    {p.photo ? "Replace" : "Upload"}
                  </button>
                  {p.photo && (
                    <button className="label hover:text-rouge" onClick={() => set(i, (x) => void (x.photo = ""))}>
                      Delete
                    </button>
                  )}
                </div>
                <label className="label block mt-3 mb-1">Her real name</label>
                <input className="box" value={p.name} onChange={(e) => set(i, (x) => void (x.name = e.target.value))} />
              </div>
              <div>
                <p className="label mb-2 text-rouge">Him · Round 3 portrait</p>
                <Portrait photo={p.malePhotos[0]} name={p.maleName} />
                <div className="flex gap-3 mt-2">
                  <button className="label hover:text-bone" onClick={() => pick((url) => set(i, (x) => void x.malePhotos.push(url)))}>
                    {p.malePhotos.length ? "Add another" : "Upload"}
                  </button>
                </div>
                <label className="label block mt-3 mb-1">His fictional name</label>
                <input className="box font-serif text-lg" value={p.maleName} onChange={(e) => set(i, (x) => void (x.maleName = e.target.value))} />
              </div>
            </div>

            {p.malePhotos.length > 0 && (
              <div className="mt-4">
                <p className="text-bone/45 text-xs mb-2">
                  His portraits rotate from question to question. The first one is shown at the unmasking.
                </p>
                <div className="flex gap-2 flex-wrap">
                  {p.malePhotos.map((ph, k) => (
                    <div key={ph.slice(-24) + k} className="w-16">
                      <Portrait photo={ph} name={p.maleName} className={k === 0 ? "outline outline-2 outline-rouge" : ""} />
                      <div className="flex justify-between mt-1">
                        <button
                          className="label hover:text-bone disabled:opacity-20"
                          disabled={k === 0}
                          title="Move earlier"
                          onClick={() => set(i, (x) => void ([x.malePhotos[k - 1], x.malePhotos[k]] = [x.malePhotos[k], x.malePhotos[k - 1]]))}
                        >
                          ←
                        </button>
                        <button className="label hover:text-rouge" title="Delete" onClick={() => set(i, (x) => void x.malePhotos.splice(k, 1))}>
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-4 mt-4 pt-3 border-t border-bone/10">
              <button className="label hover:text-bone disabled:opacity-30" disabled={i === 0} onClick={() => update((c) => void ([c.players[i - 1], c.players[i]] = [c.players[i], c.players[i - 1]]))}>
                Move up
              </button>
              <button
                className="label hover:text-bone disabled:opacity-30"
                disabled={i === players.length - 1}
                onClick={() => update((c) => void ([c.players[i + 1], c.players[i]] = [c.players[i], c.players[i + 1]]))}
              >
                Move down
              </button>
              <span className="flex-1" />
              <button className="label text-rouge/80 hover:text-rouge" onClick={() => confirm(`Remove ${p.name || "this player"}?`) && update((c) => void c.players.splice(i, 1))}>
                Remove player
              </button>
            </div>
          </article>
        ))}
      </div>

      {players.length < MAX_PLAYERS && (
        <button
          className="btn-ghost mt-6"
          onClick={() => update((c) => void c.players.push({ id: `girl-${uid(6)}`, name: "", photo: "", maleName: "", malePhotos: [] }))}
        >
          Add a player ({players.length} of {MAX_PLAYERS})
        </button>
      )}

      <section className="mt-14">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <h2 className="display text-3xl">The lineup</h2>
            <p className="text-bone/55 text-sm mt-1">How the men appear together. In the game the order is shuffled for every question.</p>
          </div>
          <button className="btn-ghost btn-sm" onClick={() => setPreview(true)} disabled={players.length < 2}>
            Preview the unmasking
          </button>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {players.map((p) => (
            <div key={p.id}>
              <Portrait photo={p.malePhotos[0]} name={p.maleName} />
              <p className="font-serif text-lg mt-1">{p.maleName || <em className="text-bone/30">No name</em>}</p>
            </div>
          ))}
        </div>
      </section>

      {preview && <UnmaskPreview players={players} onClose={() => setPreview(false)} />}
    </div>
  );
}

/** Step through the unmasking with the current portraits, as the big screen will. */
function UnmaskPreview({ players, onClose }: { players: Profile[]; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const n = players.length;
  const p = step >= 1 && step <= n ? players[step - 1] : null;
  return (
    <div className="fixed inset-0 z-[60] bg-ink overflow-y-auto">
      <div className="max-w-5xl mx-auto px-5 py-6 min-h-full flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <span className="label">Preview · the unmasking</span>
          <button className="label hover:text-bone" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="flex-1 flex flex-col justify-center" key={step}>
          {step === 0 && (
            <h1 className="display text-6xl anim-rise">
              Who were these men, <span className="italic text-acid">really?</span>
            </h1>
          )}
          {p && (
            <div className="grid sm:grid-cols-2 gap-8 items-center">
              <div className="grid grid-cols-2 gap-3">
                <div className="anim-rise">
                  <Portrait photo={p.malePhotos[0]} name={p.maleName} />
                  <p className="display text-3xl mt-2">{p.maleName}</p>
                </div>
                <div className="anim-unveil">
                  <Portrait photo={p.photo} name={p.name} />
                  <p className="display text-3xl mt-2 text-acid">{p.name}</p>
                </div>
              </div>
              <h2 className="display text-6xl leading-[0.9]">
                <span className="anim-rise block">{p.maleName}</span>
                <span className="anim-unveil block italic text-bone/50 text-[0.6em]">is actually</span>
                <span className="anim-unveil block text-acid" style={{ animationDelay: "1.9s" }}>
                  {p.name}.
                </span>
              </h2>
            </div>
          )}
          {step > n && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
              {players.map((x, i) => (
                <div key={x.id} className="anim-rise" style={{ animationDelay: `${i * 120}ms` }}>
                  <div className="grid grid-cols-2 gap-1">
                    <Portrait photo={x.malePhotos[0]} name={x.maleName} />
                    <Portrait photo={x.photo} name={x.name} />
                  </div>
                  <p className="font-serif text-xl mt-1">
                    {x.maleName} <span className="italic text-bone/45">is</span> <span className="text-acid">{x.name}</span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-8">
          <button className="btn-ghost btn-sm" disabled={step === 0} onClick={() => setStep(step - 1)}>
            Back
          </button>
          <span className="flex-1" />
          {step <= n ? (
            <button className="btn-acid btn-sm" onClick={() => setStep(step + 1)}>
              {step === 0 ? "Unmask the first" : step < n ? "Unmask the next" : "Show them all"}
            </button>
          ) : (
            <button className="btn-acid btn-sm" onClick={onClose}>
              Done
            </button>
          )}
        </div>
        <p className="text-bone/40 text-xs mt-3">In the game, the men are unmasked from fewest votes to most.</p>
      </div>
    </div>
  );
}

// ───────────────────────── bulk import ─────────────────────────

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === "," || ch === ";" || ch === "\t") row.push(cell), (cell = "");
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

const truthy = (v: unknown) => /^(1|y|yes|true|x)$/i.test(String(v ?? "").trim());

function normalize(raw: Record<string, unknown>, set: string): ContentQuestion | null {
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const hit = Object.keys(raw).find((x) => x.toLowerCase().trim() === k);
      if (hit && raw[hit] !== undefined && String(raw[hit]).trim() !== "") return raw[hit];
    }
    return undefined;
  };
  const prompt = String(get("prompt", "question") ?? "").trim();
  if (!prompt) return null;
  let options: string[] = [];
  const listed = get("options");
  if (Array.isArray(listed)) options = listed.map(String);
  else if (typeof listed === "string") options = listed.split("|").map((s) => s.trim());
  else
    for (const k of ["a", "b", "c", "d", "e", "f", "option1", "option2", "option3", "option4", "option5", "option6"]) {
      const v = get(k);
      if (v !== undefined) options.push(String(v).trim());
    }
  options = options.filter(Boolean);
  let type = String(get("type") ?? "").toLowerCase();
  if (set === "men") type = /kfm|kill/.test(type) ? "kfm" : "vote";
  else if (!["mc", "text", "number"].includes(type)) type = options.length >= 2 ? "mc" : set === "tiebreakers" ? "number" : "text";
  const ans = get("answer", "correct");
  let answer: string | number | undefined;
  if (type === "mc" && ans !== undefined) {
    const a = String(ans).trim();
    if (/^[A-Fa-f]$/.test(a)) answer = a.toUpperCase().charCodeAt(0) - 65;
    else if (/^\d+$/.test(a) && Number(a) >= 1 && Number(a) <= options.length) answer = Number(a) - 1;
    else {
      const idx = options.findIndex((o) => o.toLowerCase() === a.toLowerCase());
      answer = idx >= 0 ? idx : 0;
    }
  } else if (type === "number") answer = Number(ans ?? 0);
  else if (type === "text") answer = String(ans ?? "");
  const diff = String(get("difficulty") ?? "").toLowerCase();
  const q: ContentQuestion = { id: uid(6), type: type as ContentQuestion["type"], prompt };
  if (type === "mc") q.options = options;
  if (answer !== undefined) q.answer = answer;
  if (["easy", "medium", "hard"].includes(diff)) q.difficulty = diff as ContentQuestion["difficulty"];
  const year = Number(get("year"));
  if (year) q.year = year;
  const cat = get("category");
  if (cat) q.category = String(cat);
  const note = get("note");
  if (note) q.note = String(note);
  if (truthy(get("bonus"))) q.bonus = true;
  if (truthy(get("off", "bank"))) q.off = true;
  return q;
}

export function parseImport(text: string, set: string): ContentQuestion[] {
  const t = text.trim();
  if (!t) return [];
  if (t.startsWith("[") || t.startsWith("{")) {
    const data = JSON.parse(t);
    const list: Record<string, unknown>[] = Array.isArray(data) ? data : Array.isArray(data.questions) ? data.questions : [];
    return list.map((r) => normalize(r, set)).filter(Boolean) as ContentQuestion[];
  }
  const rows = parseCsv(t);
  const [head, ...body] = rows;
  if (!head) return [];
  return body.map((r) => normalize(Object.fromEntries(head.map((h, i) => [h, r[i]])), set)).filter(Boolean) as ContentQuestion[];
}

export function ImportBox({ set, onImport }: { set: string; onImport: (qs: ContentQuestion[]) => void }) {
  const [text, setText] = useState("");
  let parsed: ContentQuestion[] = [];
  let error: string | null = null;
  try {
    parsed = parseImport(text, set);
  } catch (e) {
    error = "That doesn’t read as CSV or JSON yet: " + (e as Error).message;
  }
  const example =
    set === "men"
      ? "prompt,type,bonus\nWho looks like he owns a boat he can’t afford?,vote,\nKill / Fuck / Marry,kfm,yes"
      : "prompt,a,b,c,d,answer,difficulty,year\nWhich year did the first iPhone go on sale?,2005,2007,2008,2009,B,easy,2007";
  return (
    <div className="border border-bone/15 p-4 mb-6 anim-fade">
      <p className="label mb-2">Paste CSV or JSON, or choose a file</p>
      <textarea className="box min-h-[120px] font-mono text-xs" placeholder={example} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="flex flex-wrap items-center gap-3 mt-3">
        <label className="btn-ghost btn-sm cursor-pointer">
          Choose file
          <input type="file" accept=".csv,.json,.txt,text/csv,application/json" className="hidden" onChange={async (e) => setText((await e.target.files?.[0]?.text()) ?? "")} />
        </label>
        <span className="text-sm text-bone/55 flex-1">
          {error ?? (parsed.length ? `${parsed.length} question${parsed.length === 1 ? "" : "s"} ready to add.` : "Columns: prompt, a–d (or options separated by |), answer (letter, number or text), difficulty, year, note, bonus.")}
        </span>
        <button className="btn-acid btn-sm" disabled={!parsed.length} onClick={() => onImport(parsed)}>
          Add {parsed.length || ""}
        </button>
      </div>
    </div>
  );
}
