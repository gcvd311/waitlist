// ───────────────────────── Content (edited in /admin, stored as JSON) ─────────────────────────

export type RoundKind = "knowHer" | "trivia" | "whoSaid" | "mostLikely" | "honoreeVs" | "final40";
export type QType = "mc" | "text" | "number";
export type Difficulty = "easy" | "medium" | "hard";

export interface ContentQuestion {
  id: string;
  type: QType;
  prompt: string; // may contain {name}
  options?: string[]; // mc only
  answer?: string | number; // mc: option index; text: string; number: number
  accept?: string[]; // extra accepted spellings for text
  image?: string; // URL for picture questions
  note?: string; // flavour line shown on reveal
  difficulty?: Difficulty;
  category?: string;
  aboutHer?: boolean; // final40: the birthday girl sits this one out
  placeholder?: boolean; // marks content that still needs real info
}

export interface RoundConfig {
  kind: RoundKind;
  enabled: boolean;
  title: string;
  subtitle: string;
  count: number; // questions per game
  timerSec: number; // 0 = no timer
  points: number; // base points for a correct answer
}

export interface Content {
  honoree: { name: string; tagline: string; photos: string[]; facts: { id: string; text: string }[] };
  guests: string[];
  teams: { id: string; name: string }[];
  rounds: RoundConfig[];
  scoring: { speedBonus: number; surpriseMultiplier: number; mostLikelyConsensus: number; wagerFloor: number };
  questions: {
    knowHer: ContentQuestion[];
    honoreeVs: ContentQuestion[];
    final40: ContentQuestion[];
    trivia: ContentQuestion[]; // custom trivia, added to the built-in bank
    mostLikely: { id: string; prompt: string }[];
    tiebreakers: ContentQuestion[];
  };
  useBuiltInTrivia: boolean; // legacy; the bank now lives in questions.trivia
  triviaSeeded?: boolean;
  triviaLevel: "mixed" | "harder" | "hardest";
  honoreePassword: string; // her own login at /her
  honoreeAnswers: Record<string, string | number>; // answers she gave in advance, by question id
  confessions: { id: string; author: string; text: string }[];
  messages: { id: string; from: string; text: string }[];
  updatedAt: number;
}

// ───────────────────────── Room state (server-side, one JSON blob per room) ─────────────────────────

export interface Player {
  id: string;
  secret: string;
  name: string;
  team: string;
  isHonoree: boolean;
  joinedAt: number;
  photo?: string;
}

export interface RoomQuestion {
  key: string;
  kind: RoundKind | "tiebreak";
  type: QType | "vote";
  prompt: string;
  options: string[];
  optionIds?: string[]; // vote: player ids
  answer?: string | number;
  accept?: string[];
  image?: string;
  note?: string;
  category?: string;
  difficulty?: Difficulty;
  points: number;
  timerSec: number;
  aboutHer?: boolean;
  placeholder?: boolean;
}

export interface RoomRound {
  kind: RoundKind;
  title: string;
  subtitle: string;
  count: number;
  timerSec: number;
  points: number;
  questions: RoomQuestion[]; // built when the round starts
}

export type Phase = "lobby" | "round_intro" | "wager" | "question" | "reveal" | "leaderboard" | "final";

export interface Answer {
  value: string | number;
  at: number;
  frac: number; // fraction of time remaining when submitted
}

export interface RoomState {
  code: string;
  createdAt: number;
  content: Content; // snapshot at room creation
  players: Record<string, Player>;
  confessions: { id: string; author: string; text: string }[]; // submitted in lobby
  rounds: RoomRound[];
  roundIndex: number;
  qIndex: number;
  phase: Phase;
  current: RoomQuestion | null;
  deadline: number | null;
  paused: boolean;
  pausedRemaining: number | null;
  answers: Record<string, Record<string, Answer>>;
  honoreeAnswers: Record<string, string | number>;
  marks: Record<string, Record<string, boolean>>; // manual right/wrong overrides
  wagers: Record<string, Record<string, number>>; // qKey -> teamId -> amount
  awards: Record<string, Record<string, number>>; // qKey -> playerId -> pts
  teamAwards: Record<string, Record<string, number>>; // qKey -> teamId -> pts
  adjustments: { id: string; target: "team" | "player"; targetId: string; delta: number; at: number }[];
  skipped: string[];
  tiebreakCount: number;
  finishedAt: number | null;
}

// ───────────────────────── What clients receive ─────────────────────────

export interface PublicPlayer {
  id: string;
  name: string;
  team: string;
  isHonoree: boolean;
  online: boolean;
  score: number;
  photo?: string;
}

export interface PublicTeam {
  id: string;
  name: string;
  score: number;
  wager: number | null;
  maxWager: number;
}

export interface RevealData {
  correct: string | number | null; // display string or index
  correctIndex: number | null;
  correctText: string | null;
  distribution: number[]; // per option counts
  results: { playerId: string; name: string; team: string; value: string | number | null; display: string; correct: boolean; points: number }[];
  teamResults: { teamId: string; points: number; display?: string }[];
  note?: string;
  surprise?: boolean;
  voteWinners?: string[];
}

export interface RoomView {
  code: string;
  serverNow: number;
  role: "host" | "player";
  phase: Phase;
  paused: boolean;
  deadline: number | null;
  pausedRemaining: number | null;
  honoree: { name: string; tagline: string; photos: string[] };
  teams: PublicTeam[];
  players: PublicPlayer[];
  round: { index: number; total: number; kind: RoundKind; title: string; subtitle: string; qIndex: number; qCount: number } | null;
  roundTitles: { kind: RoundKind; title: string }[];
  question: (Omit<RoomQuestion, "answer" | "accept"> & { answer?: string | number; accept?: string[] }) | null;
  answeredIds: string[];
  eligibleIds: string[];
  reveal: RevealData | null;
  me: {
    id: string;
    name: string;
    team: string;
    isHonoree: boolean;
    answer: string | number | null;
    eligible: boolean;
    role: "guess" | "honoree" | "sitout" | "presubmitted";
    photo?: string;
  } | null;
  confessionCount: number;
  myConfessions: number;
  messages: { from: string; text: string }[];
  tie: boolean;
  isTiebreak: boolean;
  fact: string | null;
  // host-only extras
  hostAnswers?: Record<string, string | number>;
  honoreeAnswered?: boolean;
  placeholderWarning?: boolean;
}

export type HostAction =
  | { type: "start" }
  | { type: "next" }
  | { type: "reveal" }
  | { type: "skip" }
  | { type: "skipRound" }
  | { type: "restartRound" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "addTime"; seconds: number }
  | { type: "mark"; playerId: string; correct: boolean }
  | { type: "adjust"; target: "team" | "player"; targetId: string; delta: number }
  | { type: "setTeam"; playerId: string; team: string }
  | { type: "shuffleTeams" }
  | { type: "setHonoree"; playerId: string | null }
  | { type: "kick"; playerId: string }
  | { type: "tiebreak" }
  | { type: "backToLobby" };

export type PlayerAction =
  | { type: "answer"; key: string; value: string | number }
  | { type: "wager"; key: string; amount: number }
  | { type: "confess"; text: string }
  | { type: "photo"; photo: string };
