import { buildView, GameError } from "@/lib/engine";
import { fail, ok, safeEq } from "@/lib/http";
import { getRoom, onlineSet, touch } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { code: string } }) {
  try {
    const url = new URL(req.url);
    const pid = url.searchParams.get("pid");
    const secret = url.searchParams.get("s");
    const host = url.searchParams.get("h");
    const room = await getRoom(params.code);
    if (host) {
      if (!safeEq(host, room.hostToken)) throw new GameError("Not the host of this room.", 401);
      return ok(buildView(room.state, { role: "host" }, Date.now(), await onlineSet(params.code)));
    }
    if (pid && secret) {
      const p = room.state.players[pid];
      if (!p || !safeEq(secret, p.secret)) throw new GameError("You’re no longer in this room.", 401);
      await touch(params.code, pid);
      return ok(buildView(room.state, { role: "player", pid }, Date.now(), await onlineSet(params.code)));
    }
    // Anonymous peek: enough for the join screen.
    return ok({ code: room.state.code, phase: room.state.phase, honoree: room.state.content.honoree.name, players: Object.keys(room.state.players).length });
  } catch (e) {
    return fail(e);
  }
}
