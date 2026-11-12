// ───────────────────────── Content (edited in /admin, stored as JSON) ─────────────────────────

export type RoundKind = "knowHer" | "past40" | "men" | "finale" | "trivia" | "whoSaid" | "mostLikely" | "honoreeVs" | "final40";
export type QType = "mc" | "text" | "number" | "vote" | "kfm";
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
  off?: boolean; // kept in the bank, not played
  bonus?: boolean; // played after the main questions when the round includes bonuses
  year?: number; // The Past 40 Years: shown as the question's label
  optionsFrom?: "players"; // options are the girls' names, filled in at game time
  fromPool?: boolean; // a Who Said That? slot, filled from the confessions
  askHer?: boolean; // she can answer it in advance on her page
  points?: number; // overrides the round's points
}

/** One of the girls, and the man she becomes in Round 3. */
export interface Profile {
  id: string;
  name: string;
  photo: string;
  maleName: string;
  malePhotos: string[]; // rotated across the men's questions
  honoree?: boolean;
}

export interface RoundConfig {
  kind: RoundKind;
  enabled: boolean;
  title: string;
  subtitle: string;
  count: number; // questions per game
  timerSec: number; // 0 = no timer
  points: number; // base points for a correct answer
  includeBonus?: boolean;
}

export interface Content {
  schemaVersion?: number;
  players: Profile[];
  teamsEnabled: boolean;
  honoree: { name: string; tagline: string; photos: string[]; facts: { id: string; text: string }[] };
  mascots?: string[]; // the host's own cat artwork; the built-in cat shows when empty
  guests: string[];
  teams: { id: string; name: string }[];
  rounds: RoundConfig[];
  scoring: {
    speedBonus: number;
    surpriseMultiplier: number;
    mostLikelyConsensus: number;
    wagerFloor: number;
    menWinner: number; // the girl behind the most-voted man gets these
    menParticipation: number; // every voter gets these
    hideScoresUntilEnd: boolean;
    autoReveal: boolean; // reveal as soon as everyone has answered (otherwise the host taps)
  };
  questions: {
    knowHer: ContentQuestion[];
    past40: ContentQuestion[];
    men: ContentQuestion[];
    finale: ContentQuestion[];
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
  profileId?: string;
}

export interface RoomQuestion {
  key: string;
  kind: RoundKind | "tiebreak";
  type: QType | "vote";
  prompt: string;
  options: string[];
  optionIds?: string[]; // vote: player ids, or secret character tokens in Round 3
  optionPhotos?: string[];
  bonus?: boolean;
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
  includeBonus?: boolean;
  questions: RoomQuestion[]; // built when the round starts
}

export type Phase = "lobby" | "round_intro" | "wager" | "question" | "reveal" | "unmask" | "leaderboard" | "final";

/** A man in Round 3. The token is random per round; who he really is never leaves the server until the unmasking. */
export interface CastMember {
  token: string;
  profileId: string;
  maleName: string;
  photos: string[];
}

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
  cast: CastMember[];
  hiddenKeys: string[]; // Round 3 points stay out of every score until the unmasking
  menRevealed: boolean;
  unmaskStep: number;
  unmaskOrder: string[]; // tokens, fewest votes first
}

// ───────────────────────── What clients receive ─────────────────────────

export interface PublicPlayer {
  id: string;
  name: string;
  team: string;
  isHonoree: boolean;
  online: boolean;
  score: number | null; // null while scores are sealed
  photo?: string;
  profileId?: string;
}

export interface PublicTeam {
  id: string;
  name: string;
  score: number | null;
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
  kfm?: { label: string; photo?: string; k: number; f: number; m: number }[];
}

export interface UnmaskCard {
  token: string;
  maleName: string;
  malePhoto?: string;
  votes: number;
  wins: number;
  revealed: boolean;
  femaleName?: string;
  femalePhoto?: string;
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
  mascots: string[];
  progress: { done: number; total: number };
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
  profiles: { id: string; name: string; photo: string; playerId: string | null; online: boolean; honoree: boolean }[];
  teamsEnabled: boolean;
  scoresHidden: boolean;
  unmask: { step: number; total: number; cards: UnmaskCard[] } | null;
  // host-only extras
  hostAnswers?: Record<string, string | number>;
  honoreeAnswered?: boolean;
  placeholderWarning?: boolean;
  allIn?: boolean;
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
  | { type: "release"; playerId: string }
  | { type: "tiebreak" }
  | { type: "backToLobby" };

export type PlayerAction =
  | { type: "answer"; key: string; value: string | number }
  | { type: "wager"; key: string; amount: number }
  | { type: "confess"; text: string }
  | { type: "photo"; photo: string }
  | { type: "claim"; profileId: string };
