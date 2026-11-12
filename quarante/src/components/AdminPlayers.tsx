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
  const [previewSet, setPreviewSet] = useState(0);
  const players = content.players ?? [];
  const set = (i: number, fn: (p: Profile) => void) => update((c) => fn(c.players[i]));
  const manName = (p: Profile, k: number) => (k === 0 ? p.maleName : p.maleNames?.[k] ?? "");
  const setManName = (x: Profile, k: number, v: string) => {
    if (k === 0) x.maleName = v;
    else {
      x.maleNames = [x.maleNames?.[0] ?? "", x.maleNames?.[1] ?? "", x.maleNames?.[2] ?? ""];
      x.maleNames[k] = v;
    }
  };
  const setManPhoto = (x: Profile, k: number, url: string) => {
    const arr = [0, 1, 2].map((j) => x.malePhotos[j] || "");
    arr[k] = url;
    x.malePhotos = arr;
  };

  return (
    <div>
      {ui}
      <section className="mb-10">
        <h2 className="display text-3xl">The girls, and their three men</h2>
        <p className="text-bone/55 text-sm mt-1 max-w-2xl">
          Each card is one player. On the left, her real portrait: players tap it to join. On the right, up to three men for Round 3, each with
          his own photo and name. On the Questions page you choose which man appears in each question, or let them rotate 1, 2, 3.
        </p>
      </section>

      <div className="space-y-6">
        {players.map((p, i) => (
          <article key={p.id} className="border border-bone/15 rounded-2xl p-4">
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="sm:pr-4 sm:border-r border-bone/10">
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
              {[0, 1, 2].map((k) => (
                <div key={k}>
                  <p className="label mb-2 text-rouge">Man {k + 1}</p>
                  <Portrait photo={p.malePhotos[k] || ""} name={manName(p, k) || p.maleName || "?"} />
                  <div className="flex gap-3 mt-2">
                    <button className="label hover:text-bone" onClick={() => pick((url) => set(i, (x) => setManPhoto(x, k, url)))}>
                      {p.malePhotos[k] ? "Replace" : "Upload"}
                    </button>
                    {p.malePhotos[k] && (
                      <button className="label hover:text-rouge" onClick={() => set(i, (x) => setManPhoto(x, k, ""))}>
                        Delete
                      </button>
                    )}
                  </div>
                  <label className="label block mt-3 mb-1">His name</label>
                  <input
                    className="box font-serif text-lg"
                    value={manName(p, k)}
                    placeholder={k === 0 ? "e.g. Chad" : p.maleName || "Same as Man 1"}
                    onChange={(e) => set(i, (x) => setManName(x, k, e.target.value))}
                  />
                </div>
              ))}
            </div>
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
        <div className="flex items-end justify-between gap-4 mb-4 flex-wrap">
          <div>
            <h2 className="display text-3xl">The lineup</h2>
            <p className="text-bone/55 text-sm mt-1">How each set of men looks together. In the game the order is shuffled for every question.</p>
          </div>
          <div className="flex gap-2">
            {[0, 1, 2].map((k) => (
              <button key={k} className={previewSet === k ? "btn-primary btn-sm" : "btn-ghost btn-sm"} onClick={() => setPreviewSet(k)}>
                Man {k + 1}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {players.map((p) => (
            <div key={p.id}>
              <Portrait photo={p.malePhotos[previewSet] || p.malePhotos.find(Boolean) || ""} name={manName(p, previewSet) || p.maleName} />
              <p className="font-serif text-lg mt-1">{manName(p, previewSet) || p.maleName || <em className="text-bone/30">No name</em>}</p>
            </div>
          ))}
        </div>
        <p className="text-bone/40 text-xs mt-2">If a man has no photo yet, his first available photo stands in.</p>
      </section>
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
