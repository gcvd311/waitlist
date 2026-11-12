"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, playerKey, store, type PlayerCreds } from "@/lib/client";
import { Wordmark } from "@/components/ui";
import { sfx } from "@/lib/sound";
import Link from "next/link";

export default function JoinForm({ initialCode = "" }: { initialCode?: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode.toUpperCase());
  const [name, setName] = useState("");
  const [honoree, setHonoree] = useState(false);
  const [peek, setPeek] = useState<{ honoree: string; players: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const last = store.get<string>("q40:lastName");
    if (last) setName(last);
  }, []);

  useEffect(() => {
    setPeek(null);
    if (code.length !== 4) return;
    const saved = store.get<PlayerCreds>(playerKey(code));
    if (saved) {
      router.replace(`/play/${code}`);
      return;
    }
    api<{ honoree: string; players: number }>(`/api/rooms/${code}`)
      .then((r) => {
        setPeek(r);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [code, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    sfx.unlock();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ pid: string; secret: string }>(`/api/rooms/${code}/join`, {
        method: "POST",
        body: JSON.stringify({ name, honoree }),
      });
      store.set(playerKey(code), { pid: res.pid, secret: res.secret, name } satisfies PlayerCreds);
      store.set("q40:lastName", name);
      sfx.lock();
      router.push(`/play/${code}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="min-h-[100dvh] px-6 pt-8 pb-10 max-w-md mx-auto flex flex-col">
      <header className="flex justify-between items-baseline">
        <Link href="/">
          <Wordmark className="text-2xl" />
        </Link>
        <span className="label">Join</span>
      </header>

      <form onSubmit={submit} className="flex-1 flex flex-col justify-center gap-10 py-10">
        <div className="anim-rise">
          <label className="label block mb-2" htmlFor="code">
            Room code
          </label>
          <input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4))}
            className="field font-mono text-5xl tracking-[0.3em] uppercase"
            placeholder="ABCD"
            autoCapitalize="characters"
            autoComplete="off"
            inputMode="text"
          />
          {peek && (
            <p className="mt-3 text-sm text-bone/60 anim-fade">
              For <span className="italic font-serif text-lg text-bone">{peek.honoree}</span> · {peek.players} in the room
            </p>
          )}
        </div>

        <div className="anim-rise delay-1">
          <label className="label block mb-2" htmlFor="name">
            Your name
          </label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 20))}
            className="field font-serif text-4xl"
            placeholder="As your friends say it"
            autoComplete="given-name"
          />
        </div>

        <label className="flex items-start gap-3 text-sm text-bone/70 anim-rise delay-2 cursor-pointer">
          <input type="checkbox" checked={honoree} onChange={(e) => setHonoree(e.target.checked)} className="mt-1 accent-acid w-4 h-4" />
          <span>
            I’m the birthday girl.
            <span className="block text-bone/40">You’ll answer some questions privately. Everyone else guesses.</span>
          </span>
        </label>

        {error && <p className="text-rouge text-sm">{error}</p>}

        <button className="btn-acid w-full text-lg py-5 anim-rise delay-3" disabled={busy || code.length !== 4 || !name.trim()}>
          {busy ? "Joining…" : "Take a seat"}
        </button>
      </form>
    </main>
  );
}
