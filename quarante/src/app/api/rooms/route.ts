import { isAdmin } from "@/lib/auth";
import { createRoomState, GameError, uid } from "@/lib/engine";
import { fail, ok } from "@/lib/http";
import { createRoom, getContent } from "@/lib/store";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export async function POST() {
  try {
    if (!isAdmin()) throw new GameError("Sign in to the admin to host.", 401);
    const content = await getContent();
    const hostToken = uid(24);
    const state = await createRoom((code) => createRoomState(code, content, Date.now()), hostToken);
    return ok({ code: state.code, hostToken });
  } catch (e) {
    return fail(e);
  }
}
