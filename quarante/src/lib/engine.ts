import type {
  Answer,
  CastMember,
  Profile,
  UnmaskCard,
  Content,
  ContentQuestion,
  Encore,
  HostAction,
  Player,
  PlayerAction,
  PublicPlayer,
  PublicTeam,
  RevealData,
  RoomQuestion,
  RoomRound,
  RoomState,
  RoomView,
} from "./types";

export const ENCORE_DEFAULT: Encore = {
  extraRound: true,
  extraKind: "trivia",
  extraTitle: "One More Round",
  extraCount: 5,
  tiebreaker: true,
  slideshow: true,
  slideSeconds: 8,
  image: "",
};

export class GameError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export const MAX_PLAYERS = 24;
export const ANSWER_GRACE_MS = 1500;
export const ONLINE_WINDOW_MS = 20_000;

// ───────────────────────── small helpers ─────────────────────────

export const uid = (n = 10) => {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  let s = "";
  const arr = new Uint32Array(n);
  globalThis.crypto.getRandomValues(arr);
  for (let i = 0; i < n; i++) s += chars[arr[i] % chars.length];
  return s;
};

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const fillName = (text: string, name: string) => text.replace(/\{name\}/g, name);

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\b(the|a|an|her|my)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function lev(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

/** Lenient match for free-text answers. The host can always override. */
export function textMatches(value: string, answer: string | number | undefined, accept: string[] = []): boolean {
  const v = normalize(String(value));
  if (!v) return false;
  const targets = [answer, ...accept].filter((t) => t !== undefined && String(t).trim() !== "").map((t) => normalize(String(t)));
  return targets.some((t) => {
    if (!t) return false;
    if (v === t) return true;
    if (t.length >= 5 && lev(v, t) <= Math.floor(t.length / 6) + 1) return true;
    if (t.length >= 4 && (v.includes(t) || (v.length >= 4 && t.includes(v) && v.length / t.length > 0.6))) return true;
    return false;
  });
}

export function cleanName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, 20);
}

// ───────────────────────── room creation ─────────────────────────

export function createRoomState(code: string, content: Content, now: number): RoomState {
  const rounds: RoomRound[] = content.rounds
    .filter((r) => r.enabled && r.kind !== "likely") // the bonus game is launched by the host, never part of the 40
    .map((r) => ({
      kind: r.kind,
      title: r.title,
      subtitle: r.subtitle,
      count: r.count,
      timerSec: r.timerSec,
      points: r.points,
      includeBonus: r.includeBonus,
      questions: [],
    }));
  return {
    code,
    createdAt: now,
    content,
    players: {},
    confessions: [],
    rounds,
    roundIndex: -1,
    qIndex: -1,
    phase: "lobby",
    current: null,
    deadline: null,
    paused: false,
    pausedRemaining: null,
    answers: {},
    honoreeAnswers: {},
    marks: {},
    wagers: {},
    awards: {},
    teamAwards: {},
    adjustments: [],
    skipped: [],
    tiebreakCount: 0,
    finishedAt: null,
    cast: [],
    hiddenKeys: [],
    menRevealed: false,
    unmaskStep: 0,
    unmaskOrder: [],
  };
}

export const profileOf = (state: RoomState, p: Player): Profile | undefined =>
  p.profileId ? state.content.players?.find((x) => x.id === p.profileId) : undefined;

// ───────────────────────── building questions ─────────────────────────

const DIFF_MULT = { easy: 1, medium: 1.5, hard: 2 } as const;
const DIFF_ORDER = { easy: 0, medium: 1, hard: 2 } as const;

function shuffleOptions(q: ContentQuestion): { options: string[]; answer?: number } {
  const options = q.options ?? [];
  if (q.type !== "mc" || typeof q.answer !== "number") return { options, answer: q.answer as number | undefined };
  const order = shuffle(options.map((_, i) => i));
  return { options: order.map((i) => options[i]), answer: order.indexOf(q.answer) };
}

function toRoomQ(
  q0: ContentQuestion,
  round: RoomRound,
  key: string,
  name: string,
  shuffleOpts: boolean,
  herAnswers: Record<string, string | number> = {},
  names: string[] = [],
): RoomQuestion {
  // An answer she gave in advance on her own page beats whatever the host typed.
  const her = herAnswers[q0.id];
  const hasHer = her !== undefined && her !== "";
  let q: ContentQuestion = hasHer ? { ...q0, answer: her, placeholder: false } : q0;
  // "Who is this about?": the options are the girls, the answer is a name.
  if (q.optionsFrom === "players" && names.length) {
    const target = typeof q.answer === "string" ? q.answer.trim().toLowerCase() : "";
    const idx = names.findIndex((n) => n.toLowerCase() === target);
    q = { ...q, type: "mc", options: names, answer: idx >= 0 ? idx : undefined, placeholder: idx < 0 ? true : q.placeholder };
  }
  const { options, answer } = shuffleOpts ? shuffleOptions(q) : { options: q.options ?? [], answer: q.answer };
  return {
    key,
    kind: round.kind,
    type: q.type,
    prompt: fillName(q.prompt, name),
    options: q.type === "mc" ? options.map((o) => fillName(o, name)) : [],
    answer: q.type === "text" && typeof answer === "string" ? fillName(answer, name) : answer,
    accept: q.accept,
    image: q.image || undefined,
    note: q.note ? fillName(q.note, name) : undefined,
    category: q.year ? String(q.year) : q.category,
    difficulty: q.difficulty,
    points: q.points ?? (round.kind === "trivia" ? Math.round(round.points * DIFF_MULT[q.difficulty ?? "medium"]) : round.points),
    timerSec: round.timerSec,
    aboutHer: q.aboutHer,
    placeholder: q.placeholder,
    bonus: q.bonus,
  };
}

function usable(q: ContentQuestion): boolean {
  if (q.fromPool) return true;
  if (!q.prompt?.trim()) return false;
  if ("image" in q && q.image === "") return false; // picture question without a picture yet
  if (q.optionsFrom === "players") return true;
  if (q.type === "mc" && (!q.options || q.options.filter(Boolean).length < 2)) return false;
  return true;
}

/** The round's main questions in admin order (switched-on only), then any bonus questions. */
function pick(list: ContentQuestion[], round: RoomRound & { includeBonus?: boolean }): ContentQuestion[] {
  const on = list.filter((q) => !q.off && usable(q));
  const main = on.filter((q) => !q.bonus).slice(0, round.count);
  const bonus = round.includeBonus ? on.filter((q) => q.bonus) : [];
  return [...main, ...bonus];
}

/** The girls' names for "who is it?" options: claimed names first, then the admin's list. */
export function girlNames(state: RoomState): string[] {
  const names: string[] = [];
  const add = (n?: string) => {
    const t = (n ?? "").trim();
    if (t && !names.some((x) => x.toLowerCase() === t.toLowerCase())) names.push(t);
  };
  const profiles = state.content.players ?? [];
  if (profiles.length) {
    for (const pr of profiles) {
      const claimed = Object.values(state.players).find((p) => p.profileId === pr.id);
      add(claimed?.name ?? pr.name);
    }
  }
  Object.values(state.players)
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .forEach((p) => add(p.name));
  return names;
}

function buildCast(state: RoomState): CastMember[] {
  return (state.content.players ?? [])
    .filter((p) => p.maleName.trim() || p.malePhotos.some(Boolean))
    .map((p) => ({
      token: uid(8),
      profileId: p.id,
      maleName: p.maleName.trim() || p.name,
      photos: [0, 1, 2].map((k) => p.malePhotos[k] || ""),
      names: [0, 1, 2].map((k) => (k === 0 ? p.maleName : p.maleNames?.[k] ?? "").trim()),
    }));
}

export function buildRound(state: RoomState, index: number): RoomQuestion[] {
  const round = state.rounds[index];
  const c = state.content;
  const name = c.honoree.name;
  const nonce = uid(4);
  const key = (j: number) => `r${index}q${j}.${nonce}`;
  const players = Object.values(state.players).sort((a, b) => a.joinedAt - b.joinedAt);

  const her = c.honoreeAnswers ?? {};
  const names = girlNames(state);
  // An encore round skips anything already asked tonight and draws on the whole bank, switched off or not.
  const played = new Set(
    state.rounds.filter((_, i) => i !== index).flatMap((r) => r.questions.map((q) => q.prompt.trim().toLowerCase())),
  );
  const fresh = (prompt: string) => !played.has(fillName(prompt, name).trim().toLowerCase());
  const pickFor = (list: ContentQuestion[]) => {
    if (!round.extra) return pick(list, round);
    const all = list.filter((q) => usable(q) && fresh(q.prompt));
    return [...all.filter((q) => !q.off), ...all.filter((q) => q.off)].slice(0, round.count);
  };
  switch (round.kind) {
    case "knowHer":
      return pickFor(c.questions.knowHer).map((q, j) => toRoomQ(q, round, key(j), name, false, her, names));
    case "past40":
      return pickFor(c.questions.past40 ?? []).map((q, j) => toRoomQ(q, round, key(j), name, true, her, names));
    case "finale": {
      const pool = shuffle([...c.confessions, ...state.confessions].filter((x) => x.text.trim() && x.author.trim() && (!round.extra || fresh(x.text))));
      const out: RoomQuestion[] = [];
      for (const q of pickFor(c.questions.finale ?? [])) {
        if (q.fromPool) {
          const conf = pool.shift();
          if (!conf) continue; // no confessions left: the slot quietly drops out
          out.push(
            toRoomQ({ ...q, type: "mc", prompt: conf.text.trim(), answer: conf.author, optionsFrom: "players", placeholder: false, note: q.note }, round, key(out.length), name, false, {}, names),
          );
          out[out.length - 1].kind = "whoSaid";
          continue;
        }
        out.push(toRoomQ(q, round, key(out.length), name, false, her, names));
      }
      return out;
    }
    case "men": {
      state.cast = buildCast(state);
      if (state.cast.length < 2) return [];
      const menQs = pickFor(c.questions.men ?? []);
      return (menQs.length ? menQs : pick(c.questions.men ?? [], { ...round, extra: false })).map((q, j) => {
        const lineup = shuffle(state.cast); // one fresh order per question, the same on every phone
        const chosen = lineup; // Kill / F / Marry uses the whole lineup too
        // Which of her three men: the question's choice, or rotate 1, 2, 3, 1…
        const slot = typeof q.manSet === "number" ? q.manSet : j % 3;
        const photoOf = (m: CastMember) => m.photos[slot] || m.photos.find(Boolean) || "";
        const nameOf = (m: CastMember) => m.names[slot] || m.maleName;
        return {
          key: key(j),
          kind: "men" as const,
          type: q.type === "kfm" ? ("kfm" as const) : ("vote" as const),
          prompt: fillName(q.prompt, name),
          options: chosen.map(nameOf),
          optionIds: chosen.map((m) => m.token),
          optionPhotos: chosen.map(photoOf),
          points: 0,
          timerSec: round.timerSec,
          bonus: q.bonus,
        };
      });
    }
    case "honoreeVs":
      return pickFor(c.questions.honoreeVs).map((q, j) => toRoomQ(q, round, key(j), name, false, her, names));
    case "final40":
      return pickFor(c.questions.final40).map((q, j) => toRoomQ(q, round, key(j), name, true, her, names));
    case "trivia": {
      const all = c.questions.trivia.filter((q) => usable(q) && !q.off && fresh(q.prompt));
      const level = c.triviaLevel ?? "mixed";
      const ok = (q: ContentQuestion) =>
        level === "hardest" ? q.difficulty === "hard" : level === "harder" ? q.difficulty !== "easy" : true;
      let pool = shuffle(all.filter(ok));
      if (pool.length < round.count) pool = [...pool, ...shuffle(all.filter((q) => !ok(q)))];
      const picked = pool.slice(0, round.count);
      picked.sort((a, b) => DIFF_ORDER[a.difficulty ?? "medium"] - DIFF_ORDER[b.difficulty ?? "medium"]);
      return picked.map((q, j) => toRoomQ(q, round, key(j), name, true));
    }
    case "whoSaid": {
      const pool = shuffle([...c.confessions, ...state.confessions].filter((x) => x.text.trim() && x.author.trim() && fresh(x.text)));
      const names: string[] = [];
      const add = (n: string) => {
        const t = n.trim();
        if (t && !names.some((x) => x.toLowerCase() === t.toLowerCase())) names.push(t);
      };
      players.forEach((p) => add(p.name));
      c.guests.forEach(add);
      pool.forEach((x) => add(x.author));
      return pool.slice(0, round.count).map((x, j) => ({
        key: key(j),
        kind: "whoSaid" as const,
        type: "mc" as const,
        prompt: x.text.trim(),
        options: names,
        answer: names.findIndex((n) => n.toLowerCase() === x.author.trim().toLowerCase()),
        points: round.points,
        timerSec: round.timerSec,
      }));
    }
    case "likely": {
      // The girls themselves, by portrait. A fresh order per question, the same on every phone.
      const girls = (c.players ?? []).map((pr) => {
        const claimed = Object.values(state.players).find((p) => p.profileId === pr.id);
        return { id: pr.id, name: (claimed?.name ?? pr.name).trim() || pr.name, photo: pr.photo || claimed?.photo || "" };
      });
      if (girls.length < 2) return [];
      return c.questions.likely
        .filter((p) => p.prompt.trim())
        .map((p, j) => {
          const order = shuffle(girls);
          return {
            key: key(j),
            kind: "likely" as const,
            type: "vote" as const,
            prompt: fillName(p.prompt, name),
            options: order.map((g) => g.name),
            optionIds: order.map((g) => g.id),
            optionPhotos: order.map((g) => g.photo),
            points: round.points,
            timerSec: round.timerSec,
          };
        });
    }
    case "mostLikely":
      return shuffle(c.questions.mostLikely.filter((p) => p.prompt.trim() && fresh(p.prompt)))
        .slice(0, round.count)
        .map((p, j) => ({
          key: key(j),
          kind: "mostLikely" as const,
          type: "vote" as const,
          prompt: fillName(p.prompt, name),
          options: players.map((pl) => pl.name),
          optionIds: players.map((pl) => pl.id),
          points: round.points,
          timerSec: round.timerSec,
        }));
  }
}

// ───────────────────────── eligibility & scoring ─────────────────────────

export function isEligible(q: RoomQuestion, p: Player): boolean {
  if (!p.isHonoree) return true;
  if (q.kind === "knowHer" || q.kind === "honoreeVs") return false;
  if ((q.kind === "final40" || q.kind === "finale") && q.aboutHer) return false;
  return true;
}

function honoreeAnswerFor(state: RoomState, q: RoomQuestion): string | number | undefined {
  if (q.kind !== "honoreeVs") return q.answer;
  return state.honoreeAnswers[q.key] ?? q.answer;
}

function autoCorrect(state: RoomState, q: RoomQuestion, value: string | number): boolean {
  const target = honoreeAnswerFor(state, q);
  if (q.type === "mc") return typeof target === "number" && target >= 0 && value === target;
  if (q.type === "text") return typeof value === "string" && textMatches(value, target, q.accept);
  return false;
}

export function isCorrect(state: RoomState, q: RoomQuestion, pid: string, value: string | number): boolean {
  const mark = state.marks[q.key]?.[pid];
  if (mark !== undefined) return mark;
  return autoCorrect(state, q, value);
}

export function computeAwards(state: RoomState, q: RoomQuestion): void {
  const answers = state.answers[q.key] ?? {};
  const awards: Record<string, number> = {};
  const teamAwards: Record<string, number> = {};
  const sc = state.content.scoring;

  if (q.kind === "men") {
    // Votes for a man are points for the girl he is.
    for (const pid of Object.keys(answers)) if (sc.menParticipation > 0 && state.players[pid]) awards[pid] = sc.menParticipation;
    if (q.type === "vote" && sc.menWinner > 0) {
      const counts = q.options.map((_, i) => Object.values(answers).filter((a) => a.value === i).length);
      const max = Math.max(0, ...counts);
      if (max > 0) {
        counts.forEach((n, i) => {
          if (n !== max) return;
          const member = state.cast.find((m) => m.token === q.optionIds?.[i]);
          const girl = member && Object.values(state.players).find((p) => p.profileId === member.profileId);
          if (girl) awards[girl.id] = (awards[girl.id] ?? 0) + sc.menWinner;
        });
      }
    }
  } else if (q.kind === "likely") {
    // Most votes wins the points; a tie at the top pays everyone in it.
    const counts = q.options.map((_, i) => Object.values(answers).filter((a) => a.value === i).length);
    const max = Math.max(0, ...counts);
    if (max > 0)
      counts.forEach((n, i) => {
        if (n !== max) return;
        const girl = Object.values(state.players).find((p) => p.profileId === q.optionIds?.[i]);
        if (girl) awards[girl.id] = q.points;
      });
  } else if (q.type === "vote") {
    const counts: Record<string, number> = {};
    Object.values(answers).forEach((a) => {
      const id = q.optionIds?.[a.value as number];
      if (id) counts[id] = (counts[id] ?? 0) + 1;
    });
    const max = Math.max(0, ...Object.values(counts));
    // A verdict needs at least two people agreeing; ten different names is no verdict.
    const winners = max >= 2 ? Object.keys(counts).filter((id) => counts[id] === max) : [];
    for (const [pid, a] of Object.entries(answers)) {
      const id = q.optionIds?.[a.value as number];
      if (id && winners.includes(id) && q.points > 0) awards[pid] = q.points;
    }
  } else if (q.type === "number") {
    // Closest guess wins. In a tie-breaker between teams the team gets it; otherwise the players do.
    const target = Number(q.answer);
    const entries = Object.entries(answers).filter(([pid]) => state.players[pid]);
    if (entries.length && Number.isFinite(target)) {
      const best = Math.min(...entries.map(([, a]) => Math.abs(Number(a.value) - target)));
      const winners = entries.filter(([, a]) => Math.abs(Number(a.value) - target) === best).map(([pid]) => pid);
      if (q.kind === "tiebreak" && state.content.teamsEnabled) new Set(winners.map((pid) => state.players[pid].team)).forEach((t) => (teamAwards[t] = 10));
      else winners.forEach((pid) => (awards[pid] = q.kind === "tiebreak" ? 10 : q.points));
    }
  } else if (q.kind === "final40") {
    const wagers = state.wagers[q.key] ?? {};
    state.teamAwards[q.key] = {}; // score before this question, for capping losses

    for (const team of state.content.teams) {
      const members = Object.values(state.players).filter((p) => p.team === team.id && isEligible(q, p));
      const answered = members.filter((p) => answers[p.id]);
      const right = answered.filter((p) => isCorrect(state, q, p.id, answers[p.id].value)).length;
      const w = wagers[team.id] ?? 0;
      const won = answered.length > 0 && right > answered.length / 2;
      // You can only lose what you have: a team at zero can still bet the floor, but not go negative.
      const loss = Math.min(w, Math.max(0, teamScore(state, team.id)));
      if (w > 0) teamAwards[team.id] = won ? w : -loss;
    }
  } else {
    const guessers = Object.keys(answers).filter((pid) => state.players[pid]);
    const right = guessers.filter((pid) => isCorrect(state, q, pid, answers[pid].value));
    const surprise = q.kind === "honoreeVs" && right.length > 0 && right.length <= Math.ceil(guessers.length / 3) && guessers.length >= 3;
    for (const pid of right) {
      let pts = q.points;
      if (q.kind === "trivia" || q.kind === "past40") pts += Math.round(sc.speedBonus * Math.max(0, Math.min(1, answers[pid].frac)));
      if (surprise) pts = Math.round(pts * sc.surpriseMultiplier);
      awards[pid] = pts;
    }
  }
  state.awards[q.key] = awards;
  state.teamAwards[q.key] = teamAwards;
}

export function playerScore(state: RoomState, pid: string): number {
  let s = 0;
  for (const k in state.awards) {
    if (!state.menRevealed && state.hiddenKeys?.includes(k)) continue;
    s += state.awards[k][pid] ?? 0;
  }
  for (const a of state.adjustments) if (a.target === "player" && a.targetId === pid) s += a.delta;
  return s;
}

export function teamScore(state: RoomState, tid: string): number {
  let s = 0;
  for (const p of Object.values(state.players)) if (p.team === tid) s += playerScore(state, p.id);
  for (const k in state.teamAwards) s += state.teamAwards[k][tid] ?? 0;
  for (const a of state.adjustments) if (a.target === "team" && a.targetId === tid) s += a.delta;
  return s;
}

export function maxWager(state: RoomState, tid: string): number {
  return Math.max(teamScore(state, tid), state.content.scoring.wagerFloor);
}

// ───────────────────────── flow ─────────────────────────

function startQuestion(state: RoomState, now: number) {
  const q = state.current!;
  state.phase = "question";
  state.paused = false;
  state.pausedRemaining = null;
  state.deadline = q.timerSec > 0 ? now + q.timerSec * 1000 : null;
}

function enterRound(state: RoomState, i: number) {
  state.roundIndex = i;
  state.qIndex = -1;
  state.current = null;
  state.deadline = null;
  state.paused = false;
  state.pausedRemaining = null;
  state.rounds[i].questions = buildRound(state, i);
  state.phase = "round_intro";
}

function gotoQuestion(state: RoomState, j: number, now: number) {
  state.qIndex = j;
  state.current = state.rounds[state.roundIndex].questions[j];
  if (state.current.kind === "final40") {
    state.phase = "wager";
    state.deadline = null;
    state.wagers[state.current.key] = state.wagers[state.current.key] ?? {};
  } else startQuestion(state, now);
}

/** Tally the men's votes and line them up for the reveal, fewest votes first. */
export function menTally(state: RoomState): Record<string, { votes: number; wins: number }> {
  const t: Record<string, { votes: number; wins: number }> = Object.fromEntries(state.cast.map((m) => [m.token, { votes: 0, wins: 0 }]));
  for (const r of state.rounds) {
    if (r.kind !== "men") continue;
    for (const q of r.questions) {
      if (q.type !== "vote") continue;
      const counts = q.options.map((_, i) => Object.values(state.answers[q.key] ?? {}).filter((a) => a.value === i).length);
      const max = Math.max(0, ...counts);
      counts.forEach((n, i) => {
        const tok = q.optionIds?.[i];
        if (!tok || !t[tok]) return;
        t[tok].votes += n;
        if (n === max && max > 0) t[tok].wins++;
      });
    }
  }
  return t;
}

function startUnmask(state: RoomState) {
  const tally = menTally(state);
  state.unmaskOrder = [...state.cast].sort((a, b) => tally[a.token].votes - tally[b.token].votes || a.maleName.localeCompare(b.maleName)).map((m) => m.token);
  state.unmaskStep = 0;
  state.current = null;
  state.deadline = null;
  state.phase = "unmask";
}

function afterRound(state: RoomState) {
  state.current = null;
  state.deadline = null;
  state.phase = "leaderboard";
}

function finish(state: RoomState, now: number) {
  state.current = null;
  state.deadline = null;
  state.phase = "final";
  state.finishedAt = state.finishedAt ?? now;
}

function reveal(state: RoomState) {
  const q = state.current;
  if (!q) return;
  computeAwards(state, q);
  state.phase = "reveal";
  state.deadline = null;
  state.paused = false;
  state.pausedRemaining = null;
}

function advance(state: RoomState, now: number) {
  switch (state.phase) {
    case "lobby":
      if (!Object.keys(state.players).length) throw new GameError("Nobody has joined yet.");
      if (!state.rounds.length) throw new GameError("No rounds are enabled. Turn some on in the admin.");
      enterRound(state, 0);
      return;
    case "round_intro": {
      const r = state.rounds[state.roundIndex];
      if (!r.questions.length) return nextRoundOrFinish(state, now);
      gotoQuestion(state, 0, now);
      return;
    }
    case "wager":
      startQuestion(state, now);
      return;
    case "question":
      reveal(state);
      return;
    case "reveal": {
      if (state.current?.kind === "tiebreak") return finish(state, now);
      const r = state.rounds[state.roundIndex];
      if (state.qIndex + 1 < r.questions.length) gotoQuestion(state, state.qIndex + 1, now);
      else {
        if (r.kind === "men") state.menRevealed = true; // no unmasking: everyone already knows who is who
        afterRound(state);
      }
      return;
    }
    case "unmask":
      if (state.unmaskStep <= state.unmaskOrder.length) state.unmaskStep++;
      else {
        state.menRevealed = true;
        afterRound(state);
      }
      return;
    case "leaderboard":
      return nextRoundOrFinish(state, now);
    case "final":
      return;
  }
}

function nextRoundOrFinish(state: RoomState, now: number) {
  if (state.roundIndex + 1 < state.rounds.length) enterRound(state, state.roundIndex + 1);
  else finish(state, now);
}

function clearKeys(state: RoomState, keys: string[]) {
  for (const k of keys) {
    delete state.answers[k];
    delete state.awards[k];
    delete state.teamAwards[k];
    delete state.wagers[k];
    delete state.marks[k];
    delete state.honoreeAnswers[k];
  }
  state.skipped = state.skipped.filter((k) => !keys.includes(k));
}

export function isTie(state: RoomState): boolean {
  const scores = (state.content.teamsEnabled ? state.content.teams.map((t) => teamScore(state, t.id)) : Object.keys(state.players).map((id) => playerScore(state, id))).sort((a, b) => b - a);
  return scores.length > 1 && scores[0] === scores[1];
}

function assignTeam(state: RoomState): string {
  if (!state.content.teamsEnabled) return state.content.teams[0]?.id ?? "all";
  const counts = state.content.teams.map((t) => ({ id: t.id, n: Object.values(state.players).filter((p) => p.team === t.id).length }));
  counts.sort((a, b) => a.n - b.n);
  return counts[0].id;
}

// ───────────────────────── public API: join / player / host ─────────────────────────

export function joinRoom(
  state: RoomState,
  rawName: string,
  opts: { now: number; isOnline: (pid: string) => boolean; honoree?: boolean; profileId?: string },
): Player {
  if (opts.profileId) return claimProfile(state, rawName, opts.profileId, opts);
  const name = cleanName(rawName);
  if (name.length < 1) throw new GameError("Enter a name.");
  const existing = Object.values(state.players).find((p) => p.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    if (opts.isOnline(existing.id)) throw new GameError(`“${existing.name}” is already playing. Try another name, or wait a few seconds if that’s you on another phone.`, 409);
    return existing; // reclaim: same name, previous device has gone quiet
  }
  if (Object.keys(state.players).length >= MAX_PLAYERS) throw new GameError("This room is full.");
  const hasHonoree = Object.values(state.players).some((p) => p.isHonoree);
  const p: Player = {
    id: uid(10),
    secret: uid(16),
    name,
    team: assignTeam(state),
    isHonoree: !!opts.honoree && !hasHonoree,
    joinedAt: opts.now,
  };
  state.players[p.id] = p;
  return p;
}

/** Join by tapping your own portrait. One portrait, one person; a quiet phone can be replaced. */
function claimProfile(state: RoomState, rawName: string, profileId: string, opts: { now: number; isOnline: (pid: string) => boolean }): Player {
  const profile = state.content.players?.find((x) => x.id === profileId);
  if (!profile) throw new GameError("That portrait isn’t in this game.", 404);
  const name = cleanName(rawName) || profile.name;
  const holder = Object.values(state.players).find((p) => p.profileId === profileId);
  if (holder) {
    if (opts.isOnline(holder.id)) throw new GameError(`${holder.name} is already playing as this portrait. Ask the host to unlock it if that’s wrong.`, 409);
    holder.name = name;
    return holder; // same girl on a new phone, or after a refresh: same identity, same score
  }
  if (Object.keys(state.players).length >= MAX_PLAYERS) throw new GameError("This room is full.");
  const p: Player = {
    id: uid(10),
    secret: uid(16),
    name,
    team: assignTeam(state),
    isHonoree: !!profile.honoree,
    joinedAt: opts.now,
    profileId,
  };
  if (p.isHonoree) for (const o of Object.values(state.players)) o.isHonoree = false;
  state.players[p.id] = p;
  return p;
}

export function applyPlayerAction(state: RoomState, pid: string, action: PlayerAction, now: number): string | undefined {
  const p = state.players[pid];
  if (!p) throw new GameError("You’re no longer in this room. Rejoin with your name.", 401);

  if (action.type === "photo") {
    const photo = String(action.photo ?? "");
    if (photo && !/^(https:\/\/|data:image\/|sb:\/\/)/.test(photo)) throw new GameError("That photo didn’t upload. Try another.");
    p.photo = photo || undefined;
    return;
  }

  if (action.type === "claim") {
    if (p.profileId) throw new GameError("You already have a portrait. Ask the host to unlock it.");
    const profile = state.content.players?.find((x) => x.id === action.profileId);
    if (!profile) throw new GameError("That portrait isn’t in this game.", 404);
    if (Object.values(state.players).some((o) => o.profileId === profile.id)) throw new GameError("Someone has already taken that portrait.", 409);
    p.profileId = profile.id;
    if (profile.honoree) {
      for (const o of Object.values(state.players)) o.isHonoree = false;
      p.isHonoree = true;
    }
    return;
  }

  if (action.type === "confess") {
    const text = String(action.text ?? "").replace(/\s+/g, " ").trim();
    if (text.length < 3) throw new GameError("A little more than that.");
    if (text.length > 280) throw new GameError("Keep it under 280 characters.");
    if (state.confessions.filter((c) => c.author === p.name).length >= 3) throw new GameError("Three confessions is plenty.");
    state.confessions.push({ id: uid(8), author: p.name, text });
    return "Filed. Discreetly.";
  }

  const q = state.current;
  if (!q || action.key !== q.key) throw new GameError("That question has closed.", 409);

  if (action.type === "wager") {
    if (state.phase !== "wager") throw new GameError("Wagers are closed.", 409);
    const amount = Math.round(Number(action.amount));
    const max = maxWager(state, p.team);
    if (!Number.isFinite(amount) || amount < 0 || amount > max) throw new GameError(`Wager between 0 and ${max}.`);
    state.wagers[q.key] = { ...(state.wagers[q.key] ?? {}), [p.team]: amount };
    return;
  }

  // answer
  if (state.phase !== "question") throw new GameError("Answers are closed.", 409);
  if (state.paused) throw new GameError("The game is paused.", 409);
  if (state.deadline && now > state.deadline + ANSWER_GRACE_MS) throw new GameError("Time’s up.", 409);

  let value: string | number = action.value;
  if (q.type === "kfm") {
    // "k,f,m": the option index given each fate. All three must be different men.
    const parts = String(value).split(",").map(Number);
    if (parts.length !== 3 || new Set(parts).size !== 3 || parts.some((n) => !Number.isInteger(n) || n < 0 || n >= q.options.length))
      throw new GameError("Give each of them a different fate.");
    value = parts.join(",");
  } else if (q.type === "mc" || q.type === "vote") {
    value = Number(value);
    if (!Number.isInteger(value) || value < 0 || value >= q.options.length) throw new GameError("Pick one of the options.");
  } else if (q.type === "text") {
    value = String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 140);
    if (!value) throw new GameError("Type an answer first.");
  } else {
    value = Number(value);
    if (!Number.isFinite(value)) throw new GameError("Enter a number.");
  }

  const frac = state.deadline && q.timerSec ? Math.max(0, Math.min(1, (state.deadline - now) / (q.timerSec * 1000))) : 1;

  if (q.kind === "honoreeVs" && p.isHonoree) {
    if (q.answer !== undefined) return "Already answered in advance.";
    state.honoreeAnswers[q.key] = value; // she can change her mind until the reveal
  } else {
    if (!isEligible(q, p)) throw new GameError("You sit this one out.", 403);
    const bucket = (state.answers[q.key] = state.answers[q.key] ?? {});
    // Players can change their answer until time is up or the host reveals; the last one counts.
    const prev = bucket[pid];
    if (prev && prev.value === value) return "same";
    bucket[pid] = { value, at: now, frac } satisfies Answer;
  }

  if ((q.kind === "likely" || (state.content.scoring.autoReveal && q.kind !== "men")) && everyoneAnswered(state)) reveal(state);
  return;
}

export function everyoneAnswered(state: RoomState): boolean {
  const q = state.current;
  if (!q || state.phase !== "question") return false;
  const players = Object.values(state.players);
  const eligible = players.filter((p) => isEligible(q, p));
  if (!eligible.length) return false;
  const answers = state.answers[q.key] ?? {};
  if (!eligible.every((p) => answers[p.id])) return false;
  if (q.kind === "honoreeVs" && q.answer === undefined && players.some((p) => p.isHonoree) && state.honoreeAnswers[q.key] === undefined) return false;
  return true;
}

/** Any client may call this; it only acts if the timer really has run out. */
export function applyTimeout(state: RoomState, now: number): boolean {
  if (state.phase === "question" && !state.paused && state.deadline && now > state.deadline + ANSWER_GRACE_MS) {
    reveal(state);
    return true;
  }
  return false;
}

/**
 * One step back: to the previous question (shown with its answer), from a round's first
 * question to its intro, from an intro or the scores to the end of the previous round.
 * Nothing already answered is lost.
 */
function goBack(state: RoomState) {
  const showQuestion = (ri: number, qi: number) => {
    const r = state.rounds[ri];
    if (!r?.questions.length) {
      state.roundIndex = ri;
      state.qIndex = -1;
      state.current = null;
      state.phase = "round_intro";
      return;
    }
    state.roundIndex = ri;
    state.qIndex = qi;
    state.current = r.questions[qi];
    computeAwards(state, state.current);
    state.phase = "reveal";
  };
  state.deadline = null;
  state.paused = false;
  state.pausedRemaining = null;
  switch (state.phase) {
    case "question":
    case "wager":
    case "reveal":
      if (state.current?.kind === "tiebreak") {
        state.current = null;
        state.phase = "final";
        return;
      }
      if (state.qIndex > 0) return showQuestion(state.roundIndex, state.qIndex - 1);
      state.current = null;
      state.qIndex = -1;
      state.phase = "round_intro";
      return;
    case "round_intro": {
      const prev = state.roundIndex - 1;
      if (prev < 0) throw new GameError("This is the first round.");
      const qs = state.rounds[prev].questions;
      return showQuestion(prev, Math.max(0, qs.length - 1));
    }
    case "leaderboard":
    case "unmask": {
      const qs = state.rounds[state.roundIndex].questions;
      return showQuestion(state.roundIndex, Math.max(0, qs.length - 1));
    }
    case "final":
      state.finishedAt = null;
      state.current = null;
      state.phase = "leaderboard";
      return;
    case "lobby":
      return;
  }
}

export function applyHostAction(state: RoomState, action: HostAction, now: number): void {
  switch (action.type) {
    case "start":
      if (state.phase !== "lobby") throw new GameError("Already started.", 409);
      return advance(state, now);
    case "next":
      if (state.paused) throw new GameError("Resume first.", 409);
      return advance(state, now);
    case "reveal":
      if (state.phase === "question") reveal(state);
      return;
    case "skip":
      if ((state.phase === "question" || state.phase === "wager") && state.current) {
        const k = state.current.key;
        clearKeys(state, [k]);
        state.skipped.push(k);
        state.phase = "reveal";
        state.awards[k] = {};
        state.teamAwards[k] = {};
        state.paused = false;
        state.pausedRemaining = null;
      }
      return advance(state, now);
    case "skipRound":
      if (state.phase === "lobby" || state.phase === "final") return;
      if (state.phase === "unmask") state.menRevealed = true;
      if (state.current && (state.phase === "question" || state.phase === "wager")) clearKeys(state, [state.current.key]);
      return nextRoundOrFinish(state, now);
    case "restartRound": {
      if (state.roundIndex < 0 || state.phase === "final") throw new GameError("No round to restart.");
      clearKeys(state, state.rounds[state.roundIndex].questions.map((q) => q.key));
      return enterRound(state, state.roundIndex);
    }
    case "pause":
      if (state.paused) return;
      state.paused = true;
      if (state.phase === "question" && state.deadline) {
        state.pausedRemaining = Math.max(0, state.deadline - now);
        state.deadline = null;
      }
      return;
    case "resume":
      if (!state.paused) return;
      state.paused = false;
      if (state.pausedRemaining !== null) state.deadline = now + state.pausedRemaining;
      state.pausedRemaining = null;
      return;
    case "addTime":
      if (state.phase === "question") {
        const ms = Math.max(5, Math.min(120, action.seconds)) * 1000;
        if (state.deadline) state.deadline = Math.max(state.deadline, now) + ms;
        else if (state.pausedRemaining !== null) state.pausedRemaining += ms;
      }
      return;
    case "mark": {
      const q = state.current;
      if (!q || state.phase !== "reveal") throw new GameError("Marking is only possible on the reveal.", 409);
      state.marks[q.key] = { ...(state.marks[q.key] ?? {}), [action.playerId]: action.correct };
      computeAwards(state, q);
      return;
    }
    case "adjust": {
      const delta = Math.round(Number(action.delta));
      if (!Number.isFinite(delta) || delta === 0) return;
      state.adjustments.push({ id: uid(6), target: action.target, targetId: action.targetId, delta, at: now });
      return;
    }
    case "setTeam":
      if (state.players[action.playerId] && state.content.teams.some((t) => t.id === action.team)) state.players[action.playerId].team = action.team;
      return;
    case "shuffleTeams": {
      const teams = state.content.teams.map((t) => t.id);
      const ps = shuffle(Object.values(state.players));
      ps.sort((a, b) => Number(b.isHonoree) - Number(a.isHonoree));
      ps.forEach((p, i) => (p.team = teams[i % teams.length]));
      return;
    }
    case "setHonoree":
      for (const p of Object.values(state.players)) p.isHonoree = p.id === action.playerId;
      return;
    case "release": {
      const p = state.players[action.playerId];
      if (p) {
        p.profileId = undefined;
        p.isHonoree = false;
      }
      return;
    }
    case "kick":
      delete state.players[action.playerId];
      if (everyoneAnswered(state)) reveal(state);
      return;
    case "tiebreak": {
      if (state.phase !== "final") throw new GameError("Tie-breakers happen at the end.");
      state.slideshow = false;
      const pool = state.content.questions.tiebreakers.filter((q) => q.prompt.trim() && q.answer !== undefined && q.answer !== "");
      if (!pool.length) throw new GameError("Add a tie-breaker question in the admin.");
      const src = pool[state.tiebreakCount % pool.length];
      state.tiebreakCount++;
      state.current = {
        key: `tb${state.tiebreakCount}.${uid(4)}`,
        kind: "tiebreak",
        type: "number",
        prompt: fillName(src.prompt, state.content.honoree.name),
        options: [],
        answer: Number(src.answer),
        note: src.note,
        points: 10,
        timerSec: 30,
      };
      startQuestion(state, now);
      return;
    }
    case "extraRound": {
      if (state.phase !== "final") throw new GameError("Encore rounds start from the final screen.");
      const e = state.content.encore;
      if (!e?.extraRound) throw new GameError("The extra round is switched off in the admin.");
      const base = state.content.rounds.find((r) => r.kind === e.extraKind);
      if (!base) throw new GameError("Pick a round for the encore in the admin.");
      state.rounds.push({
        kind: base.kind,
        title: e.extraTitle.trim() || base.title,
        subtitle: base.subtitle,
        count: Math.max(1, e.extraCount || base.count),
        timerSec: base.timerSec,
        points: base.points,
        extra: true,
        questions: [],
      });
      const i = state.rounds.length - 1;
      enterRound(state, i);
      if (!state.rounds[i].questions.length) {
        state.rounds.pop();
        throw new GameError("No questions left for that round. Add some, or pick another round for the encore in the admin.");
      }
      state.slideshow = false;
      state.finishedAt = null;
      return;
    }
    case "bonusGame": {
      // MOST LIKELY TO... slots in right after the current round, so the main game carries on afterwards.
      const base = state.content.rounds.find((r) => r.kind === "likely");
      if (!base) throw new GameError("The bonus game isn’t set up. Add its questions in the admin.");
      if (state.current && (state.phase === "question" || state.phase === "wager")) clearKeys(state, [state.current.key]);
      // Before a round that hasn't started; otherwise after the current one (or at the end, from the final).
      const at =
        state.phase === "final" || state.roundIndex >= state.rounds.length
          ? state.rounds.length
          : state.phase === "lobby"
            ? 0
            : state.phase === "round_intro"
              ? state.roundIndex
              : state.roundIndex + 1;
      state.rounds.splice(at, 0, {
        kind: "likely",
        title: base.title || "MOST LIKELY TO...",
        subtitle: base.subtitle,
        count: 0,
        timerSec: base.timerSec,
        points: base.points || 10,
        extra: true,
        bonusGame: true,
        questions: [],
      });
      enterRound(state, at);
      if (!state.rounds[at].questions.length) {
        state.rounds.splice(at, 1);
        throw new GameError("Add at least one MOST LIKELY TO question, and two players with portraits, in the admin.");
      }
      state.rounds[at].count = state.rounds[at].questions.length;
      state.slideshow = false;
      state.paused = false;
      state.pausedRemaining = null;
      state.finishedAt = null;
      return;
    }
    case "jump": {
      const target = Math.floor(Number(action.round));
      if (!Number.isFinite(target) || target < 0) throw new GameError("Pick a round.");
      if (state.current && (state.phase === "question" || state.phase === "wager")) clearKeys(state, [state.current.key]);
      if (state.phase === "unmask") state.menRevealed = true;
      state.paused = false;
      state.pausedRemaining = null;
      state.slideshow = false;
      if (target >= state.rounds.length) return finish(state, now);
      state.finishedAt = null;
      return enterRound(state, target);
    }
    case "slideshow":
      if (action.on && state.phase !== "final") throw new GameError("The slideshow plays on the final screen.");
      state.slideshow = !!action.on;
      return;
    case "back":
      if (state.slideshow) return void (state.slideshow = false);
      return goBack(state);
    case "backToLobby":
      for (const r of state.rounds) clearKeys(state, r.questions.map((q) => q.key)), (r.questions = []);
      state.rounds = state.rounds.filter((r) => !r.extra);
      state.slideshow = false;
      Object.assign(state, {
        roundIndex: -1,
        qIndex: -1,
        phase: "lobby",
        current: null,
        deadline: null,
        paused: false,
        pausedRemaining: null,
        answers: {},
        honoreeAnswers: {},
        marks: {},
        wagers: {},
        awards: {},
        teamAwards: {},
        adjustments: [],
        skipped: [],
        tiebreakCount: 0,
        finishedAt: null,
        cast: [],
        hiddenKeys: [],
        menRevealed: false,
        unmaskStep: 0,
        unmaskOrder: [],
      });
      return;
  }
}

// ───────────────────────── views ─────────────────────────

function displayValue(q: RoomQuestion, v: string | number | undefined | null): string {
  if (v === undefined || v === null || v === "") return "";
  if (q.type === "mc" || q.type === "vote") return q.options[v as number] ?? "";
  return String(v);
}

export function buildReveal(state: RoomState, q: RoomQuestion): RevealData {
  const answers = state.answers[q.key] ?? {};
  const awards = state.awards[q.key] ?? {};
  const teamAwards = state.teamAwards[q.key] ?? {};
  const target = honoreeAnswerFor(state, q);
  const distribution = q.options.map((_, i) => Object.values(answers).filter((a) => a.value === i).length);

  const results = Object.values(state.players)
    .filter((p) => answers[p.id] || isEligible(q, p))
    .filter((p) => !(q.kind === "honoreeVs" && p.isHonoree))
    .map((p) => {
      const a = answers[p.id];
      const correct =
        q.type === "vote" || q.type === "number" ? (awards[p.id] ?? 0) > 0 : a ? isCorrect(state, q, p.id, a.value) : false;
      return {
        playerId: p.id,
        name: p.name,
        team: p.team,
        value: a?.value ?? null,
        display: a ? displayValue(q, a.value) : "",
        correct,
        points: awards[p.id] ?? 0,
      };
    })
    .sort((a, b) => b.points - a.points || Number(b.correct) - Number(a.correct) || a.name.localeCompare(b.name));

  let voteWinners: string[] | undefined;
  if (q.type === "vote") {
    const max = Math.max(0, ...distribution);
    voteWinners = max >= (q.kind === "men" || q.kind === "likely" ? 1 : 2) ? q.options.filter((_, i) => distribution[i] === max) : [];
  }
  let kfm: RevealData["kfm"];
  if (q.type === "kfm") {
    kfm = q.options.map((label, i) => ({ label, photo: q.optionPhotos?.[i] || undefined, k: 0, f: 0, m: 0 }));
    for (const a of Object.values(answers)) {
      const [k, f, m] = String(a.value).split(",").map(Number);
      if (kfm[k]) kfm[k].k++;
      if (kfm[f]) kfm[f].f++;
      if (kfm[m]) kfm[m].m++;
    }
  }

  const right = results.filter((r) => r.correct).length;
  const surprise = q.kind === "honoreeVs" && right > 0 && right <= Math.ceil(results.filter((r) => r.value !== null).length / 3) && results.filter((r) => r.value !== null).length >= 3;

  const correctIndex = (q.type === "mc") && typeof target === "number" && target >= 0 ? target : null;
  const correctText =
    q.type === "mc" ? (correctIndex !== null ? q.options[correctIndex] : null) : q.type === "vote" ? (voteWinners?.join(" & ") || null) : target !== undefined && target !== "" ? String(target) : null;

  return {
    correct: target ?? null,
    correctIndex,
    correctText,
    distribution,
    results,
    teamResults: Object.entries(teamAwards).map(([teamId, points]) => ({ teamId, points })),
    note: q.note,
    surprise,
    voteWinners,
    kfm,
  };
}

function unmaskView(state: RoomState): RoomView["unmask"] {
  if (state.phase !== "unmask") return null;
  const tally = menTally(state);
  const total = state.unmaskOrder.length;
  const cards: UnmaskCard[] = state.unmaskOrder.map((tok, i) => {
    const m = state.cast.find((x) => x.token === tok)!;
    // Only cards already turned over carry who she is. The rest never leave the server.
    const revealed = state.unmaskStep > i;
    const profile = revealed ? state.content.players?.find((p) => p.id === m.profileId) : undefined;
    const girl = revealed ? Object.values(state.players).find((p) => p.profileId === m.profileId) : undefined;
    return {
      token: tok,
      maleName: m.maleName,
      malePhoto: m.photos.find(Boolean),
      votes: tally[tok]?.votes ?? 0,
      wins: tally[tok]?.wins ?? 0,
      revealed,
      femaleName: revealed ? girl?.name ?? profile?.name : undefined,
      femalePhoto: revealed ? profile?.photo || girl?.photo : undefined,
    };
  });
  return { step: state.unmaskStep, total, cards };
}

/** Votes stay anonymous, and while scores are sealed nobody sees points. */
function privateReveal(r: RevealData, q: RoomQuestion, viewer: { role: "host" } | { role: "player"; pid: string }, sealed: boolean): RevealData {
  let results = r.results;
  if (q.kind === "men" || q.kind === "mostLikely" || q.kind === "likely") results = viewer.role === "player" ? results.filter((x) => x.playerId === viewer.pid) : [];
  if (q.kind === "men") results = results.map((x) => ({ ...x, correct: false, points: 0 }));
  if (sealed) results = results.map((x) => ({ ...x, points: 0 }));
  return { ...r, results, teamResults: sealed ? [] : r.teamResults };
}

export function buildView(
  state: RoomState,
  viewer: { role: "host" } | { role: "player"; pid: string },
  now: number,
  online: Set<string>,
): RoomView {
  const c = state.content;
  const name = c.honoree.name;
  const sealed = !!c.scoring.hideScoresUntilEnd && state.phase !== "final";
  const players: PublicPlayer[] = Object.values(state.players)
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .map((p) => ({
      id: p.id,
      name: p.name,
      team: p.team,
      isHonoree: p.isHonoree,
      online: online.has(p.id),
      score: sealed ? null : playerScore(state, p.id),
      photo: profileOf(state, p)?.photo || p.photo,
      profileId: p.profileId,
    }));
  const q = state.current;
  const wagers = q ? state.wagers[q.key] : undefined;
  const teams: PublicTeam[] = c.teams.map((t) => ({ id: t.id, name: t.name, score: sealed ? null : teamScore(state, t.id), wager: wagers?.[t.id] ?? null, maxWager: maxWager(state, t.id) }));
  const round = state.roundIndex >= 0 && state.rounds[state.roundIndex] ? state.rounds[state.roundIndex] : null;
  const isHost = viewer.role === "host";
  const me = viewer.role === "player" ? state.players[viewer.pid] : undefined;
  const showAnswer = isHost || state.phase === "reveal";

  let question: RoomView["question"] = null;
  if (q) {
    // optionIds in Round 3 are the secret tokens: they never go to any screen.
    const { answer, accept, optionIds, ...rest } = q;
    const ids = q.kind === "men" ? undefined : optionIds;
    question = showAnswer ? { ...rest, optionIds: ids, answer, accept } : { ...rest, optionIds: ids };
  }

  const answers = q ? state.answers[q.key] ?? {} : {};
  let meView: RoomView["me"] = null;
  if (me) {
    const eligible = q ? isEligible(q, me) : true;
    const herVs = !!q && q.kind === "honoreeVs" && me.isHonoree;
    const presubmitted = herVs && q!.answer !== undefined;
    const isHerTurn = herVs && !presubmitted;
    meView = {
      id: me.id,
      name: me.name,
      team: me.team,
      isHonoree: me.isHonoree,
      answer: q ? (isHerTurn ? state.honoreeAnswers[q.key] ?? null : answers[me.id]?.value ?? null) : null,
      eligible: eligible || isHerTurn,
      role: presubmitted ? "presubmitted" : isHerTurn ? "honoree" : eligible ? "guess" : "sitout",
      photo: profileOf(state, me)?.photo || me.photo,
    };
  }

  const view: RoomView = {
    code: state.code,
    serverNow: now,
    role: viewer.role,
    phase: state.phase,
    paused: state.paused,
    deadline: state.deadline,
    pausedRemaining: state.pausedRemaining,
    honoree: { name, tagline: c.honoree.tagline, photos: c.honoree.photos },
    mascots: c.mascots ?? [],
    progress: (() => {
      // Planned questions across the enabled rounds, and how far in we are.
      // Bonus questions don't count towards the 40.
      const main = (r: RoomRound) => (r.bonusGame ? 0 : r.questions.length ? Math.min(r.count, r.questions.filter((x) => !x.bonus).length) : r.count);
      const total = state.rounds.reduce((n, r) => n + main(r), 0);
      const cur = state.rounds[state.roundIndex];
      const before = state.rounds.slice(0, Math.max(0, state.roundIndex)).reduce((n, r) => n + main(r), 0);
      return { done: state.roundIndex < 0 || !cur ? 0 : before + Math.min(main(cur), Math.max(0, state.qIndex + 1)), total };
    })(),
    teams,
    players,
    round: round
      ? {
          index: state.roundIndex,
          total: state.rounds.length,
          kind: round.kind,
          title: fillName(round.title, name),
          subtitle: fillName(round.subtitle, name),
          qIndex: state.qIndex,
          qCount: round.questions.length,
        }
      : null,
    roundTitles: state.rounds.map((r) => ({ kind: r.kind, title: fillName(r.title, name), subtitle: fillName(r.subtitle, name), count: r.count })),
    question,
    answeredIds: Object.keys(answers),
    eligibleIds: q ? Object.values(state.players).filter((p) => isEligible(q, p)).map((p) => p.id) : [],
    reveal: q && state.phase === "reveal" ? privateReveal(buildReveal(state, q), q, viewer, sealed) : null,
    me: meView,
    confessionCount: state.confessions.length + c.confessions.length,
    myConfessions: me ? state.confessions.filter((x) => x.author === me.name).length : 0,
    messages: state.phase === "final" || isHost ? c.messages.map((m) => ({ from: m.from, text: m.text, photos: [...(m.photo ? [m.photo] : []), ...(m.photos ?? [])].filter(Boolean) })).filter((m) => m.text.trim() || m.photos.length) : [],
    encore: { ...ENCORE_DEFAULT, ...(c.encore ?? {}) },
    slideshow: state.phase === "final" && !!state.slideshow,
    tie: state.phase === "final" && isTie(state),
    isTiebreak: q?.kind === "tiebreak",
    fact: (() => {
      const facts = c.honoree.facts.filter((f) => f.text.trim());
      return state.phase === "leaderboard" && facts.length ? fillName(facts[Math.max(0, state.roundIndex) % facts.length].text, name) : null;
    })(),
    profiles: (c.players ?? []).map((pr) => {
      const holder = Object.values(state.players).find((p) => p.profileId === pr.id);
      return { id: pr.id, name: holder?.name ?? pr.name, photo: pr.photo, playerId: holder?.id ?? null, online: !!holder && online.has(holder.id), honoree: !!pr.honoree };
    }),
    teamsEnabled: !!c.teamsEnabled,
    scoresHidden: sealed,
    unmask: unmaskView(state),
  };
  if (isHost && q) {
    view.hostAnswers = Object.fromEntries(Object.entries(answers).map(([pid, a]) => [pid, a.value]));
    view.honoreeAnswered = state.honoreeAnswers[q.key] !== undefined || (q.kind === "honoreeVs" && q.answer !== undefined);
    view.placeholderWarning = !!q.placeholder;
    view.allIn = everyoneAnswered(state);
  }
  return view;
}
