import { fail, ok } from "@/lib/http";
import { getContent, resolvePhotos } from "@/lib/store";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

/** What the welcome screens may show before anyone has joined: her name and the cat artwork. */
export async function GET() {
  try {
    const c = await getContent();
    return ok(await resolvePhotos({ name: c.honoree.name, mascots: c.mascots ?? [] }));
  } catch (e) {
    return fail(e);
  }
}
