import { GameError, uid } from "@/lib/engine";
import { body, fail, ok } from "@/lib/http";
import { getContent, mutateContent } from "@/lib/store";

export const dynamic = "force-dynamic";

// Public pre-party form: friends send a confession (for Who Said That?) and/or a message for her.
export async function GET() {
  try {
    const c = await getContent();
    return ok({ name: c.honoree.name });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const b = await body<{ name: string; confessions: string[]; message: string }>(req);
    const name = String(b.name ?? "").replace(/\s+/g, " ").trim().slice(0, 20);
    if (!name) throw new GameError("Add your name. Only the host sees it.");
    const confessions = (Array.isArray(b.confessions) ? b.confessions : [])
      .map((t) => String(t ?? "").replace(/\s+/g, " ").trim())
      .filter((t) => t.length >= 3)
      .slice(0, 3)
      .map((t) => t.slice(0, 280));
    const message = String(b.message ?? "").trim().slice(0, 600);
    if (!confessions.length && !message) throw new GameError("Write at least one confession or a message.");
    await mutateContent((c) => {
      if (c.confessions.length > 300) throw new GameError("The vault is full.");
      confessions.forEach((text) => c.confessions.push({ id: uid(8), author: name, text }));
      if (message) c.messages.push({ id: uid(8), from: name, text: message });
      if (!c.guests.some((g) => g.toLowerCase() === name.toLowerCase())) c.guests.push(name);
    });
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
