import { TRIVIA_BANK } from "./triviaBank";
import type { Content, ContentQuestion } from "./types";

// Everything about the birthday girl is a PLACEHOLDER until edited in /admin.
// Nothing here is a fact about a real person.

const ph = (id: string, prompt: string, extra: Partial<ContentQuestion> = {}): ContentQuestion => ({
  id,
  type: "text",
  prompt,
  answer: "",
  placeholder: true,
  ...extra,
});

const mc = (id: string, prompt: string, options: string[], extra: Partial<ContentQuestion> = {}): ContentQuestion => ({
  id,
  type: "mc",
  prompt,
  options,
  ...extra,
});

export const DEFAULT_CONTENT: Content = {
  honoree: {
    name: "The Birthday Girl",
    tagline: "Forty, and entirely unrepentant.",
    photos: [],
    facts: [],
  },
  guests: [],
  teams: [
    { id: "cour", name: "Côté Cour" },
    { id: "jardin", name: "Côté Jardin" },
  ],
  rounds: [
    { kind: "knowHer", enabled: true, title: "How Well Do You Know Her?", subtitle: "Forty years of evidence. Let’s see who was paying attention.", count: 8, timerSec: 45, points: 100 },
    { kind: "trivia", enabled: true, title: "General Trivia", subtitle: "Everything you once knew and swore you’d never forget.", count: 12, timerSec: 20, points: 100 },
    { kind: "whoSaid", enabled: true, title: "Who Said That?", subtitle: "Anonymous confessions. Not anonymous for long.", count: 8, timerSec: 30, points: 100 },
    { kind: "mostLikely", enabled: true, title: "Most Likely To", subtitle: "Secret ballot. Public consequences.", count: 8, timerSec: 20, points: 50 },
    { kind: "honoreeVs", enabled: true, title: "{name} vs. Everyone", subtitle: "She answers in private. You try to read her mind.", count: 6, timerSec: 30, points: 100 },
    { kind: "final40", enabled: true, title: "The Final 40", subtitle: "Wager what you can afford to lose.", count: 6, timerSec: 30, points: 0 },
  ],
  scoring: { speedBonus: 50, surpriseMultiplier: 2, mostLikelyConsensus: 50, wagerFloor: 200 },
  useBuiltInTrivia: true,
  triviaSeeded: true,
  triviaLevel: "harder",
  honoreePassword: "",
  honoreeAnswers: {},
  questions: {
    knowHer: [
      ph("kh-1", "What was {name}’s first job?"),
      ph("kh-2", "Who was {name}’s first celebrity crush?"),
      ph("kh-3", "What is {name}’s most irrational fear?"),
      ph("kh-4", "Name {name}’s most regrettable fashion phase."),
      mc("kh-5", "What is {name}’s go-to drink?", ["Placeholder A", "Placeholder B", "Placeholder C", "Placeholder D"], { answer: 0, placeholder: true }),
      ph("kh-6", "What would {name} spend €10,000 on, no questions asked?"),
      ph("kh-7", "Which celebrity would {name} marry tomorrow?"),
      ph("kh-8", "What is {name}’s most passionately held pet peeve?"),
      ph("kh-9", "What does {name} secretly love?"),
      ph("kh-10", "Where was this photo taken? (Upload a photo in the admin.)", { image: "" }),
    ],
    honoreeVs: [
      mc("hv-1", "{name}’s ideal Sunday:", ["A lunch that becomes dinner", "Bed, linen, a book", "A gallery and a long walk", "Something she won’t tell us about"]),
      mc("hv-2", "{name} must give one up for a year:", ["Cheese", "Wine", "Her phone", "The group chat"]),
      mc("hv-3", "Her honest reaction to turning forty:", ["Finally.", "Absolutely not.", "What birthday?", "Bring it, quietly."]),
      mc("hv-4", "Where would {name} most like to wake up tomorrow?", ["Paris", "A Greek island", "New York", "Exactly where she is"]),
      mc("hv-5", "{name}’s real reply time to a text:", ["Instantly", "Within the hour", "Three to five working days", "A seven-minute voice note"]),
      mc("hv-6", "Who does {name} call first from a holding cell?", ["Her mother", "Her partner", "Someone in this room", "A lawyer she once dated"]),
      mc("hv-7", "Which would {name} rather never do again?", ["Camping", "Long-haul in economy", "Split a group bill evenly", "Give a wedding speech"]),
      mc("hv-8", "{name}’s best era so far:", ["Her twenties", "Her thirties", "This one, obviously", "The one that’s coming"]),
    ],
    final40: [
      mc("f-1", "Which came first?", ["The first Harry Potter book", "Google", "Euro banknotes", "Facebook"], { answer: 0, category: "The last forty years" }),
      mc("f-2", "In which year did “Friends” end?", ["2004", "2002", "2003", "2006"], { answer: 0, category: "The last forty years" }),
      mc("f-3", "Best Picture at the 1998 Oscars went to:", ["Titanic", "Good Will Hunting", "As Good as It Gets", "L.A. Confidential"], { answer: 0, category: "The last forty years" }),
      mc("f-4", "Which launched first?", ["YouTube", "Twitter", "Netflix streaming", "Instagram"], { answer: 0, category: "The last forty years" }),
      mc("f-5", "The Berlin Wall fell in:", ["1989", "1987", "1990", "1991"], { answer: 0, category: "The last forty years" }),
      mc("f-6", "Beyoncé’s first solo album:", ["Dangerously in Love", "B’Day", "4", "Lemonade"], { answer: 0, category: "The last forty years" }),
      mc("f-7", "Which was never a Spice Girls nickname?", ["Glam", "Sporty", "Posh", "Baby"], { answer: 0, category: "The last forty years" }),
      ph("f-8", "Where did {name} meet the longest-standing friend in this room?", { aboutHer: true, category: "Her life" }),
      ph("f-9", "What city did {name} turn thirty in?", { aboutHer: true, category: "Her life" }),
      ph("f-10", "Finish the sentence {name} says most: “Honestly, …”", { aboutHer: true, category: "Her life" }),
    ],
    trivia: TRIVIA_BANK.map((q) => ({ ...q })),
    mostLikely: [
      "marry for money",
      "survive longest on a deserted island",
      "date someone twenty years younger",
      "accidentally become famous",
      "disappear from a party without saying goodbye",
      "send a voice note longer than five minutes",
      "befriend the waiter and get dessert on the house",
      "still be dancing at 3am",
      "have a secret second Instagram",
      "text an ex before this trip is over",
      "be mistaken for someone famous",
      "move abroad on a whim",
      "get us asked to leave somewhere",
      "know every word of a 2002 R&B single",
      "give the speech nobody asked for",
      "cry at an advert",
    ].map((p, i) => ({ id: `ml-${i + 1}`, prompt: `Who is most likely to ${p}?` })),
    tiebreakers: [
      { id: "tb-1", type: "number", prompt: "In what year did the first iPhone go on sale?", answer: 2007 },
      { id: "tb-2", type: "number", prompt: "How long is “Titanic” (1997), in minutes?", answer: 194 },
      { id: "tb-3", type: "number", prompt: "How many episodes of “Sex and the City” (the series) were made?", answer: 94 },
      { id: "tb-4", type: "number", prompt: "In what year was Madonna’s “Vogue” released?", answer: 1990 },
      { id: "tb-5", type: "number", prompt: "How tall is the Eiffel Tower, in metres, antennas included?", answer: 330 },
    ],
  },
  confessions: [],
  messages: [],
  updatedAt: 0,
};
