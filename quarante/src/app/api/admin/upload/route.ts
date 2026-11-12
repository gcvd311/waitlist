import { isAdmin } from "@/lib/auth";
import { GameError } from "@/lib/engine";
import { body, fail, ok } from "@/lib/http";
import { resolvePhotos, uploadPhoto } from "@/lib/store";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    if (!isAdmin()) throw new GameError("Admin only.", 401);
    const { dataUrl } = await body<{ dataUrl: string }>(req);
    if (typeof dataUrl !== "string" || dataUrl.length > 6_000_000) throw new GameError("Image too large.");
    return ok({ url: await resolvePhotos(await uploadPhoto(dataUrl)) });
  } catch (e) {
    return fail(e);
  }
}
