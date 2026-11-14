import { checkHerPassword, isHer, setHerCookie } from "@/lib/auth";
import { fillName, GameError } from "@/lib/engine";
import { body, fail, ok } from "@/lib/http";
import { getContent, mutateContent, resolvePhotos } from "@/lib/store";
import type { Content } from "@/lib/types";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

/** The questions she can answer in advance, without the host's answers. */
function herQuestions(c: Content) {
  const name = c.honoree.name;
  const pick = (set: string, q: Content["questions"]["knowHer"][number]) => ({
    id: q.id,
    set,
    type: q.type,
    prompt: fillName(q.prompt, name),
    options: q.type === "mc" ? (q.options ?? []).map((o) => fillName(o, name)) : [],
    image: q.image || undefined,
  });
  return [
    ...c.questions.knowHer.filter((q) => q.prompt.trim() && !q.off && !q.optionsFrom && !("image" in q && !q.image)).map((q) => pick("knowHer", q)),
    ...(c.questions.finale ?? []).filter((q) => q.askHer && q.prompt.trim() && !q.off).map((q) => pick("finale", q)),
  ];
}

export async function GET() {
  try {
    const c = await getContent();
    if (!isHer(c.honoreePassword)) return ok({ authed: false, name: c.honoree.name, configured: !!c.honoreePassword });
    return ok({ authed: true, name: c.honoree.name, questions: await resolvePhotos(herQuestions(c)), answers: c.honoreeAnswers ?? {} });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const { password } = await body<{ password: string }>(req);
    const c = await getContent();
    if (!c.honoreePassword) throw new GameError("The host hasn’t set your password yet.", 400);
    await new Promise((r) => setTimeout(r, 300));
    if (!checkHerPassword(String(password ?? ""), c.honoreePassword)) throw new GameError("That’s not it. Ask the host.", 401);
    setHerCookie(c.honoreePassword);
    return ok({ authed: true });
  } catch (e) {
    return fail(e);
  }
}

/** Save one answer at a time, so nothing she has typed is lost. */
export async function PUT(req: Request) {
  try {
    const { id, value, options } = await body<{ id: string; value?: string | number | null; options?: string[] }>(req);
    await mutateContent((c) => {
      if (!isHer(c.honoreePassword)) throw new GameError("Please sign in again.", 401);
      const q = herQuestions(c).find((x) => x.id === id);
      if (!q) throw new GameError("That question no longer exists.", 404);
      c.honoreeAnswers = c.honoreeAnswers ?? {};
      // She can write her own answer choices for multiple-choice questions.
      if (Array.isArray(options)) {
        if (q.type !== "mc") throw new GameError("Only multiple-choice questions have options.");
        const clean = options.map((o) => String(o ?? "").slice(0, 80));
        if (clean.length < 2 || clean.length > 6) throw new GameError("Between 2 and 6 options.");
        const src = [...c.questions.knowHer, ...(c.questions.finale ?? []), ...c.questions.honoreeVs, ...c.questions.final40].find((x) => x.id === id);
        if (!src) throw new GameError("That question no longer exists.", 404);
        src.options = clean;
        src.placeholder = false;
        const mine = c.honoreeAnswers[id];
        if (typeof mine === "number" && mine >= clean.length) delete c.honoreeAnswers[id];
        return;
      }
      if (value === null || value === "") delete c.honoreeAnswers[id];
      else if (q.type === "mc") {
        const n = Number(value);
        const len = ([...c.questions.knowHer, ...(c.questions.finale ?? []), ...c.questions.honoreeVs, ...c.questions.final40].find((x) => x.id === id)?.options ?? q.options).length;
        if (!Number.isInteger(n) || n < 0 || n >= len) throw new GameError("Pick one of the options.");
        c.honoreeAnswers[id] = n;
      } else c.honoreeAnswers[id] = String(value).trim().slice(0, 140);
    });
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
