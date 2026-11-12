import { isAdmin } from "@/lib/auth";
import { GameError } from "@/lib/engine";
import { body, fail, ok } from "@/lib/http";
import { getContent, hasSupabase, mergeContent, resolvePhotos, saveContent, unresolvePhotos } from "@/lib/store";
import type { Content } from "@/lib/types";

export const dynamic = "force-dynamic";

// Content includes the answers, so it is admin-only.
export async function GET() {
  try {
    if (!isAdmin()) throw new GameError("Admin only.", 401);
    return ok({ content: await resolvePhotos(await getContent()), backend: hasSupabase() ? "supabase" : "memory" });
  } catch (e) {
    return fail(e);
  }
}

export async function PUT(req: Request) {
  try {
    if (!isAdmin()) throw new GameError("Admin only.", 401);
    const { content } = await body<{ content: Content }>(req);
    if (!content || typeof content !== "object") throw new GameError("Missing content.");
    if (JSON.stringify(content).length > 8_000_000) throw new GameError("Content too large. Use fewer or smaller photos.");
    return ok({ content: await resolvePhotos(await saveContent(mergeContent(unresolvePhotos(content)))) });
  } catch (e) {
    return fail(e);
  }
}
