import { buildView, joinRoom } from "@/lib/engine";
import { body, fail, ok } from "@/lib/http";
import { mutateRoom, onlineSet, touch } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { code: string } }) {
  try {
    const b = await body<{ name: string; honoree?: boolean }>(req);
    const online = await onlineSet(params.code);
    const now = Date.now();
    const { state, result: p } = await mutateRoom(params.code, (s) =>
      joinRoom(s, String(b.name ?? ""), { now, isOnline: (id) => online.has(id), honoree: !!b.honoree }),
    );
    await touch(params.code, p.id);
    online.add(p.id);
    return ok({ pid: p.id, secret: p.secret, view: buildView(state, { role: "player", pid: p.id }, Date.now(), online) });
  } catch (e) {
    return fail(e);
  }
}
