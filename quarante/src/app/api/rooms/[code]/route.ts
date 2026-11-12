import { buildView, GameError } from "@/lib/engine";
import { fail, ok, safeEq } from "@/lib/http";
import { getRoom, onlineSet, resolvePhotos, touch } from "@/lib/store";

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
      return ok(await resolvePhotos(buildView(room.state, { role: "host" }, Date.now(), await onlineSet(params.code))));
    }
    if (pid && secret) {
      const p = room.state.players[pid];
      if (!p || !safeEq(secret, p.secret)) throw new GameError("You’re no longer in this room.", 401);
      await touch(params.code, pid);
      return ok(await resolvePhotos(buildView(room.state, { role: "player", pid }, Date.now(), await onlineSet(params.code))));
    }
    // Anonymous peek: enough for the join screen (the girls' portraits, never the men).
    const online = await onlineSet(params.code);
    const profiles = (room.state.content.players ?? []).map((pr) => {
      const holder = Object.values(room.state.players).find((p) => p.profileId === pr.id);
      return { id: pr.id, name: holder?.name ?? pr.name, photo: pr.photo, taken: !!holder, online: !!holder && online.has(holder.id) };
    });
    return ok(
      await resolvePhotos({
        code: room.state.code,
        phase: room.state.phase,
        honoree: room.state.content.honoree.name,
        players: Object.keys(room.state.players).length,
        profiles,
      }),
    );
  } catch (e) {
    return fail(e);
  }
}
