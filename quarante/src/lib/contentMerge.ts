import { DEFAULT_CONTENT, SCHEMA_VERSION } from "./defaultContent";
import { TRIVIA_BANK } from "./triviaBank";
import type { Content } from "./types";

/**
 * Fill in anything a saved document is missing, and upgrade older saves to the
 * current structure without dropping a single edit.
 */
export function mergeContent(raw: Partial<Content> | null | undefined): Content {
  const d = structuredClone(DEFAULT_CONTENT);
  if (!raw) return d;
  const merged: Content = {
    ...d,
    ...raw,
    honoree: { ...d.honoree, ...(raw.honoree ?? {}) },
    scoring: { ...d.scoring, ...(raw.scoring ?? {}) },
    questions: { ...d.questions, ...(raw.questions ?? {}) },
    rounds: raw.rounds?.length ? raw.rounds : d.rounds,
    teams: raw.teams?.length ? raw.teams : d.teams,
    players: raw.players ?? d.players,
    honoreeAnswers: raw.honoreeAnswers ?? {},
    encore: { ...d.encore!, ...(raw.encore ?? {}) },
  };
  // The bonus game arrived later: give older saves its round settings (its questions merge in above).
  if (!merged.rounds.some((r) => r.kind === "likely")) merged.rounds = [...merged.rounds, ...d.rounds.filter((r) => r.kind === "likely")];
  // Older saves kept the starter trivia outside the content; fold it in so every question is editable.
  if (!raw.triviaSeeded) {
    merged.questions.trivia = [...(raw.questions?.trivia ?? []), ...(raw.useBuiltInTrivia === false ? [] : TRIVIA_BANK.map((q) => ({ ...q })))];
    merged.triviaSeeded = true;
  }
  // Version 1 → 2: the 40-question, four-round game. Old rounds become optional extras.
  if ((raw.schemaVersion ?? 1) < 2) {
    merged.rounds = d.rounds;
    merged.teamsEnabled = d.teamsEnabled;
    merged.scoring = { ...d.scoring, ...(raw.scoring ?? {}), hideScoresUntilEnd: true };
    if (!raw.honoree?.name || raw.honoree.name === "The Birthday Girl") merged.honoree.name = d.honoree.name;
    merged.schemaVersion = SCHEMA_VERSION;
  }
  // Version 2 → 3: MOST LIKELY TO... becomes a real round, played just before No Further Questions.
  if ((raw.schemaVersion ?? 1) < 3) {
    const likely = { ...(merged.rounds.find((r) => r.kind === "likely") ?? d.rounds.find((r) => r.kind === "likely")!), enabled: true };
    likely.subtitle = likely.subtitle.replace(/^A bonus game\. /, "");
    const rest = merged.rounds.filter((r) => r.kind !== "likely");
    const at = rest.findIndex((r) => r.kind === "finale");
    merged.rounds = at < 0 ? [...rest, likely] : [...rest.slice(0, at), likely, ...rest.slice(at)];
    merged.schemaVersion = SCHEMA_VERSION;
  }
  return merged;
}
