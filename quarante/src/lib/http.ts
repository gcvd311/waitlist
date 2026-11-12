import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { GameError } from "./engine";

export function ok<T>(data: T, init?: number) {
  return NextResponse.json(data, { status: init ?? 200, headers: { "Cache-Control": "no-store" } });
}

export function fail(e: unknown) {
  if (e instanceof GameError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
}

export async function body<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new GameError("Bad request.");
  }
}

export function safeEq(a: string, b: string) {
  return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
