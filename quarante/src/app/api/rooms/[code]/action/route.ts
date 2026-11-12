import { ANSWER_GRACE_MS, applyHostAction, applyPlayerAction, applyTimeout, buildView, GameError } from "@/lib/engine";
import { body, fail, ok, safeEq } from "@/lib/http";
import { getRoom, mutateRoom, onlineSet, resolvePhotos, touch, uploadPhoto } from "@/lib/store";
import type { HostAction, PlayerAction } from "@/lib/types";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

type Payload =
  | { auth: { host: string }; action: HostAction }
  | { auth: { pid: string; secret: string }; action: PlayerAction | { type: "timeout" } };

export async function POST(req: Request, { params }: { params: { code: string } }) {
  try {
    const b = await body<Payload>(req);
    if (!b?.action?.type || !b.auth) throw new GameError("Bad request.");
    const room = await getRoom(params.code);
    const now0 = Date.now();
    const timedOut =
      room.state.phase === "question" && !room.state.paused && !!room.state.deadline && now0 > room.state.deadline + ANSWER_GRACE_MS;
    // Timeouts are fired by every phone at once; only the first one needs to write.
    const noop = b.action.type === "timeout" && !timedOut;

    if ("host" in b.auth) {
      if (!safeEq(String(b.auth.host), room.hostToken)) throw new GameError("Not the host of this room.", 401);
      const action = b.action as HostAction | { type: "timeout" };
      if (noop) return ok({ view: await resolvePhotos(buildView(room.state, { role: "host" }, Date.now(), await onlineSet(params.code))) });
      const { state } = await mutateRoom(params.code, (s) =>
        action.type === "timeout" ? applyTimeout(s, Date.now()) : applyHostAction(s, action, Date.now()),
      );
      return ok({ view: await resolvePhotos(buildView(state, { role: "host" }, Date.now(), await onlineSet(params.code))) });
    }

    const { pid, secret } = b.auth;
    const p = room.state.players[pid];
    if (!p || !safeEq(String(secret), p.secret)) throw new GameError("You’re no longer in this room.", 401);
    let action = b.action as PlayerAction | { type: "timeout" };
    if (action.type === "photo" && action.photo?.startsWith("data:")) {
      if (action.photo.length > 400_000) throw new GameError("That photo is too large.");
      action = { type: "photo", photo: await uploadPhoto(action.photo) };
    }
    if (noop) return ok({ view: await resolvePhotos(buildView(room.state, { role: "player", pid }, Date.now(), await onlineSet(params.code))) });
    const { state, result } = await mutateRoom(params.code, (s) =>
      action.type === "timeout" ? (applyTimeout(s, Date.now()), undefined) : applyPlayerAction(s, pid, action, Date.now()),
    );
    await touch(params.code, pid);
    return ok({ message: result, view: await resolvePhotos(buildView(state, { role: "player", pid }, Date.now(), await onlineSet(params.code))) });
  } catch (e) {
    return fail(e);
  }
}
