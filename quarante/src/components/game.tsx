"use client";
import { LETTERS, teamColor } from "@/lib/client";
import type { PublicPlayer, PublicTeam, RevealData, RoomView } from "@/lib/types";
import { Avatar, Portrait, TeamDot } from "./ui";

/** Animated horizontal bars: options with vote counts. Used for Most Likely and answer spreads. */
export function Bars({
  rows,
  highlight,
  large = false,
}: {
  rows: { label: string; count: number; sub?: string; photo?: string; withAvatar?: boolean }[];
  highlight: (i: number) => boolean;
  large?: boolean;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className={large ? "space-y-4" : "space-y-2.5"}>
      {rows.map((r, i) => (
        <li key={i} className="anim-rise" style={{ animationDelay: `${i * 70}ms` }}>
          <div className="flex justify-between items-baseline mb-1.5 gap-4">
            <span className={`flex items-center gap-3 ${large ? "text-2xl lg:text-3xl font-serif" : "text-[15px]"} ${highlight(i) ? "text-bone" : "text-bone/50"}`}>
              {r.withAvatar && <Avatar photo={r.photo} name={r.label} size={large ? 44 : 26} />}
              {r.label}
            </span>
            <span className={`font-mono tabular-nums ${large ? "text-xl" : "text-sm"} ${highlight(i) ? "text-acid" : "text-bone/40"}`}>{r.count}</span>
          </div>
          <div className={`${large ? "h-3" : "h-1.5"} bg-bone/[0.07]`}>
            <div
              className={`h-full anim-grow ${highlight(i) ? "bg-acid" : "bg-bone/30"}`}
              style={{ width: `${(r.count / max) * 100}%`, animationDelay: `${200 + i * 90}ms` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function voteRows(view: RoomView) {
  const q = view.question!;
  const r = view.reveal!;
  return q.options
    .map((label, i) => ({
      label,
      count: r.distribution[i] ?? 0,
      i,
      withAvatar: true,
      photo: view.players.find((p) => p.id === q.optionIds?.[i])?.photo,
    }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);
}

export function Standings({ teams, large = false }: { teams: PublicTeam[]; large?: boolean }) {
  const sorted = [...teams].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const max = Math.max(1, ...teams.map((t) => Math.abs(t.score ?? 0)));
  return (
    <div className={large ? "space-y-10" : "space-y-6"}>
      {sorted.map((t, i) => (
        <div key={t.id} className="anim-rise" style={{ animationDelay: `${i * 120}ms` }}>
          <div className="flex justify-between items-end gap-4">
            <div className="flex items-center gap-3">
              <TeamDot color={teamColor(teams, t.id)} className={large ? "w-3 h-3" : ""} />
              <span className={`display ${large ? "text-6xl" : "text-3xl"} ${i === 0 && (t.score ?? 0) > 0 ? "" : "text-bone/70"}`}>{t.name}</span>
            </div>
            <span className={`font-mono tabular-nums ${large ? "text-5xl" : "text-2xl"}`}>{t.score ?? ""}</span>
          </div>
          <div className={`${large ? "h-2 mt-4" : "h-1 mt-2"} bg-bone/[0.07]`}>
            <div
              className="h-full anim-grow"
              style={{ width: `${(Math.max(0, t.score ?? 0) / max) * 100}%`, background: teamColor(teams, t.id), animationDelay: `${300 + i * 120}ms` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Individual standings, revealed from last place up to the winner. */
export function Ranking({ players, large = false, highlight }: { players: PublicPlayer[]; large?: boolean; highlight?: string }) {
  const sorted = [...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const max = Math.max(1, ...players.map((p) => Math.abs(p.score ?? 0)));
  const n = sorted.length;
  return (
    <ol className={large ? "space-y-4" : "space-y-3"}>
      {sorted.map((p, i) => (
        <li key={p.id} className="anim-rise" style={{ animationDelay: `${(n - 1 - i) * 650}ms` }}>
          <div className="flex items-center gap-3">
            <span className={`font-mono text-bone/40 ${large ? "w-8 text-lg" : "w-5 text-xs"}`}>{i + 1}</span>
            <Avatar photo={p.photo} name={p.name} size={large ? 56 : 34} ring={i === 0 ? "#D6DE5B" : undefined} />
            <span className={`flex-1 ${large ? "display text-4xl" : "text-lg"} ${p.id === highlight ? "text-acid" : ""}`}>{p.name}</span>
            <span className={`font-mono tabular-nums ${large ? "text-3xl" : "text-base"}`}>{p.score ?? ""}</span>
          </div>
          <div className={`${large ? "h-1.5 mt-2 ml-[100px]" : "h-1 mt-1.5 ml-[62px]"} bg-bone/[0.07]`}>
            <div
              className={`h-full anim-grow ${i === 0 ? "bg-acid" : "bg-bone/40"}`}
              style={{ width: `${(Math.max(0, p.score ?? 0) / max) * 100}%`, animationDelay: `${(n - 1 - i) * 650 + 200}ms` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

export function TopPlayers({ players, teams, limit = 5 }: { players: PublicPlayer[]; teams: PublicTeam[]; limit?: number }) {
  const sorted = [...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, limit);
  return (
    <ol className="divide-y divide-bone/10">
      {sorted.map((p, i) => (
        <li key={p.id} className="flex items-center justify-between py-2.5 anim-rise" style={{ animationDelay: `${400 + i * 70}ms` }}>
          <span className="flex items-center gap-3">
            <span className="font-mono text-xs text-bone/40 w-4">{i + 1}</span>
            <Avatar photo={p.photo} name={p.name} size={30} ring={teamColor(teams, p.team)} />
            <span>{p.name}</span>
          </span>
          <span className="font-mono tabular-nums text-bone/70">{p.score ?? ""}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Lay n portraits (4:5) out on the shared screen so all of them fit without scrolling:
 * one row up to six, two rows beyond. `reserved` is the height taken by everything else.
 */
export function screenGrid(n: number, reserved: number, perCell = 1) {
  const rows = n <= 6 ? 1 : 2;
  const cols = Math.ceil(n / rows);
  const maxWidth = `calc(${cols} * (((100vh - ${reserved}px) / ${rows}) - 48px) * ${0.8 * perCell})`;
  return { cols, rows, maxWidth };
}

/** Round 3's lineup: the men, in this question's order, with their photo and name. */
export function Lineup({
  view,
  chosen,
  onPick,
  disabled,
  large = false,
}: {
  view: RoomView;
  chosen?: number | null;
  onPick?: (i: number) => void;
  disabled?: boolean;
  large?: boolean;
}) {
  const q = view.question!;
  const n = q.options.length;
  const { cols, maxWidth } = large ? screenGrid(n, 360) : { cols: n <= 4 ? 2 : 3, maxWidth: undefined };
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, maxWidth }}>
      {q.options.map((name, i) => {
        const active = chosen === i;
        const Tag = onPick ? "button" : "div";
        return (
          <Tag
            key={`${q.key}-${i}`}
            {...(onPick ? { onClick: () => onPick(i), disabled, "data-option": i } : {})}
            className={`text-left anim-rise ${onPick ? "transition active:scale-[0.98]" : ""}`}
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <Portrait photo={q.optionPhotos?.[i]} name={name} dim={chosen !== null && chosen !== undefined && !active} className={active ? "outline outline-[3px] outline-acid" : ""} />
            <p className={`mt-1.5 ${large ? "display text-[clamp(1.2rem,2.2vw,2.2rem)]" : "font-serif text-xl"} ${active ? "text-acid" : ""}`}>{name}</p>
          </Tag>
        );
      })}
    </div>
  );
}

/** Kill / F / Marry results: one row per man. */
export function KfmTable({ reveal, large = false }: { reveal: RevealData; large?: boolean }) {
  const rows = reveal.kfm ?? [];
  return (
    <div className={`grid gap-6 ${large ? "grid-cols-3" : "grid-cols-1"}`}>
      {rows.map((r, i) => (
        <div key={i} className={`anim-rise ${large ? "" : "flex gap-4 items-center"}`} style={{ animationDelay: `${i * 150}ms` }}>
          <Portrait photo={r.photo} name={r.label} className={large ? "" : "w-24 shrink-0"} />
          <div className={large ? "mt-3" : "flex-1"}>
            <p className={`${large ? "display text-4xl" : "font-serif text-2xl"}`}>{r.label}</p>
            <div className="flex gap-4 mt-2 font-mono text-sm">
              <span className="text-rouge">Kill {r.k}</span>
              <span className="text-acid">F {r.f}</span>
              <span className="text-sage">Marry {r.m}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function OptionLetter({ i, active }: { i: number; active?: boolean }) {
  return <span className={`font-mono text-xs w-5 shrink-0 ${active ? "text-ink/60" : "text-bone/40"}`}>{LETTERS[i]}</span>;
}

export function revealHeadline(view: RoomView): string {
  const q = view.question!;
  const r = view.reveal!;
  if (q.kind === "men") {
    if (q.type === "kfm") return "The verdicts are in.";
    const w = r.voteWinners ?? [];
    if (!w.length) return "Nobody voted.";
    return w.length === 1 ? `${w[0]}.` : `A tie: ${w.join(" & ")}.`;
  }
  if (q.kind === "mostLikely") {
    const w = r.voteWinners ?? [];
    if (!w.length) return r.distribution.some((d) => d > 0) ? "No consensus. Suspicious." : "Nobody voted.";
    if (w.length > 3) return `A ${w.length}-way tie.`;
    return w.join(" & ");
  }
  if (q.kind === "whoSaid") return r.correctText ? `It was ${r.correctText}.` : "Unclaimed.";
  if (q.kind === "honoreeVs") return r.correctText ? `She said: ${r.correctText}` : "She kept that one to herself.";
  if (q.kind === "tiebreak") return String(r.correctText ?? "");
  return r.correctText ?? "Answer not entered yet";
}

export function RevealResultList({
  reveal,
  teams,
  players = [],
  onMark,
}: {
  reveal: RevealData;
  teams: PublicTeam[];
  players?: PublicPlayer[];
  onMark?: (pid: string, correct: boolean) => void;
}) {
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
      {reveal.results.map((r, i) => (
        <li key={r.playerId} className="flex items-center justify-between gap-3 py-2 border-b border-bone/10 anim-rise" style={{ animationDelay: `${i * 40}ms` }}>
          <span className="flex items-center gap-2.5 min-w-0">
            <Avatar photo={players.find((p) => p.id === r.playerId)?.photo} name={r.name} size={26} ring={teamColor(teams, r.team)} />
            <span className="shrink-0">{r.name}</span>
            <span className={`truncate font-serif italic text-lg ${r.correct ? "text-acid" : "text-bone/45"}`}>{r.display || "no answer"}</span>
          </span>
          <span className="flex items-center gap-2 shrink-0">
            {r.points !== 0 && <span className="font-mono text-sm text-acid">+{r.points}</span>}
            {onMark && r.value !== null && (
              <button
                onClick={() => onMark(r.playerId, !r.correct)}
                className={`font-mono text-[11px] uppercase tracking-label px-2 py-1 border ${r.correct ? "border-acid text-acid" : "border-bone/25 text-bone/50 hover:text-bone"}`}
                title="Toggle right / wrong"
              >
                {r.correct ? "Right" : "Wrong"}
              </button>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
