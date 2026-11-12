import { buildView, joinRoom } from "@/lib/engine";
import { body, fail, ok } from "@/lib/http";
import { mutateRoom, onlineSet, resolvePhotos, touch, uploadPhoto } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { code: string } }) {
  try {
    const b = await body<{ name: string; honoree?: boolean; photo?: string; profileId?: string }>(req);
    const photo = typeof b.photo === "string" && b.photo.length < 400_000 && b.photo.startsWith("data:") ? await uploadPhoto(b.photo).catch(() => undefined) : undefined;
    const online = await onlineSet(params.code);
    const now = Date.now();
    const { state, result: p } = await mutateRoom(params.code, (s) => {
      const player = joinRoom(s, String(b.name ?? ""), { now, isOnline: (id) => online.has(id), honoree: !!b.honoree, profileId: b.profileId ? String(b.profileId) : undefined });
      if (photo) player.photo = photo;
      return player;
    });
    await touch(params.code, p.id);
    online.add(p.id);
    return ok({ pid: p.id, secret: p.secret, view: await resolvePhotos(buildView(state, { role: "player", pid: p.id }, Date.now(), online)) });
  } catch (e) {
    return fail(e);
  }
}
