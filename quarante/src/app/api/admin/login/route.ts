import { checkPassword, clearAdminCookie, isAdmin, setAdminCookie, adminPassword } from "@/lib/auth";
import { body, fail, ok } from "@/lib/http";
import { GameError } from "@/lib/engine";

export const dynamic = "force-dynamic";

export async function GET() {
  return ok({ admin: isAdmin(), configured: !!adminPassword(), devDefault: !process.env.ADMIN_PASSWORD && !!adminPassword() });
}

export async function POST(req: Request) {
  try {
    const { password } = await body<{ password: string }>(req);
    if (!adminPassword()) throw new GameError("Set ADMIN_PASSWORD in your environment first.", 500);
    await new Promise((r) => setTimeout(r, 300));
    if (!checkPassword(String(password ?? ""))) throw new GameError("Wrong password.", 401);
    setAdminCookie();
    return ok({ admin: true });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE() {
  clearAdminCookie();
  return ok({ admin: false });
}
