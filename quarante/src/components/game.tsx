"use client";
import { LETTERS, teamColor } from "@/lib/client";
import type { PublicPlayer, PublicTeam, RevealData, RoomView } from "@/lib/types";
import { TeamDot } from "./ui";

/** Animated horizontal bars: options with vote counts. Used for Most Likely and answer spreads. */
export function Bars({
  rows,
  highlight,
  large = false,
}: {
  rows: { label: string; count: number; sub?: string }[];
  highlight: (i: number) => boolean;
  large?: boolean;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className={large ? "space-y-4" : "space-y-2.5"}>
      {rows.map((r, i) => (
        <li key={i} className="anim-rise" style={{ animationDelay: `${i * 70}ms` }}>
          <div className="flex justify-between items-baseline mb-1.5 gap-4">
            <span className={`${large ? "text-2xl lg:text-3xl font-serif" : "text-[15px]"} ${highlight(i) ? "text-bone" : "text-bone/50"}`}>
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
    .map((label, i) => ({ label, count: r.distribution[i] ?? 0, i }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);
}

export function Standings({ teams, large = false }: { teams: PublicTeam[]; large?: boolean }) {
  const sorted = [...teams].sort((a, b) => b.score - a.score);
  const max = Math.max(1, ...teams.map((t) => Math.abs(t.score)));
  return (
    <div className={large ? "space-y-10" : "space-y-6"}>
      {sorted.map((t, i) => (
        <div key={t.id} className="anim-rise" style={{ animationDelay: `${i * 120}ms` }}>
          <div className="flex justify-between items-end gap-4">
            <div className="flex items-center gap-3">
              <TeamDot color={teamColor(teams, t.id)} className={large ? "w-3 h-3" : ""} />
              <span className={`display ${large ? "text-6xl" : "text-3xl"} ${i === 0 && t.score > 0 ? "" : "text-bone/70"}`}>{t.name}</span>
            </div>
            <span className={`font-mono tabular-nums ${large ? "text-5xl" : "text-2xl"}`}>{t.score}</span>
          </div>
          <div className={`${large ? "h-2 mt-4" : "h-1 mt-2"} bg-bone/[0.07]`}>
            <div
              className="h-full anim-grow"
              style={{ width: `${(Math.max(0, t.score) / max) * 100}%`, background: teamColor(teams, t.id), animationDelay: `${300 + i * 120}ms` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TopPlayers({ players, teams, limit = 5 }: { players: PublicPlayer[]; teams: PublicTeam[]; limit?: number }) {
  const sorted = [...players].sort((a, b) => b.score - a.score).slice(0, limit);
  return (
    <ol className="divide-y divide-bone/10">
      {sorted.map((p, i) => (
        <li key={p.id} className="flex items-center justify-between py-2.5 anim-rise" style={{ animationDelay: `${400 + i * 70}ms` }}>
          <span className="flex items-center gap-3">
            <span className="font-mono text-xs text-bone/40 w-4">{i + 1}</span>
            <TeamDot color={teamColor(teams, p.team)} />
            <span>{p.name}</span>
          </span>
          <span className="font-mono tabular-nums text-bone/70">{p.score}</span>
        </li>
      ))}
    </ol>
  );
}

export function OptionLetter({ i, active }: { i: number; active?: boolean }) {
  return <span className={`font-mono text-xs w-5 shrink-0 ${active ? "text-ink/60" : "text-bone/40"}`}>{LETTERS[i]}</span>;
}

export function revealHeadline(view: RoomView): string {
  const q = view.question!;
  const r = view.reveal!;
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
  onMark,
}: {
  reveal: RevealData;
  teams: PublicTeam[];
  onMark?: (pid: string, correct: boolean) => void;
}) {
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
      {reveal.results.map((r, i) => (
        <li key={r.playerId} className="flex items-center justify-between gap-3 py-2 border-b border-bone/10 anim-rise" style={{ animationDelay: `${i * 40}ms` }}>
          <span className="flex items-center gap-2.5 min-w-0">
            <TeamDot color={teamColor(teams, r.team)} />
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
