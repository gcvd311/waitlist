"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, playerKey, squarePhoto, store, type PlayerCreds } from "@/lib/client";
import { Mascot, PhotoPicker, Portrait, TitleLockup, Wordmark } from "@/components/ui";
import { Sparkle } from "@/components/Cat";
import { usePublic } from "@/hooks/usePublic";
import { sfx } from "@/lib/sound";

type Peek = {
  honoree: string;
  players: number;
  profiles: { id: string; name: string; photo: string; taken: boolean; online: boolean }[];
};

export default function JoinForm({ initialCode = "" }: { initialCode?: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4));
  const [name, setName] = useState("");
  const [honoree, setHonoree] = useState(false);
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const [peek, setPeek] = useState<Peek | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { mascots } = usePublic();

  useEffect(() => {
    const last = store.get<string>("q40:lastName");
    if (last) setName(last);
  }, []);

  useEffect(() => {
    setPeek(null);
    setChosen(null);
    if (code.length !== 4) return;
    const saved = store.get<PlayerCreds>(playerKey(code));
    if (saved) {
      router.replace(`/play/${code}`);
      return;
    }
    let alive = true;
    const load = () =>
      api<Peek>(`/api/rooms/${code}`)
        .then((r) => {
          if (!alive) return;
          setPeek(r);
          setError(null);
        })
        .catch((e) => alive && setError(e.message));
    load();
    const iv = setInterval(load, 3000); // see portraits get claimed as friends join
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [code, router]);

  const profiles = peek?.profiles ?? [];
  const usePortraits = profiles.length > 0;
  const picked = profiles.find((p) => p.id === chosen);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    sfx.unlock();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ pid: string; secret: string }>(`/api/rooms/${code}/join`, {
        method: "POST",
        body: JSON.stringify(usePortraits ? { name: name || picked?.name, profileId: chosen } : { name, honoree, photo }),
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
    <main className="min-h-[100dvh] px-3 pt-5 pb-10 max-w-md mx-auto flex flex-col overflow-hidden">
      <header className="flex justify-center">
        <Link href="/">
          <Wordmark className="text-lg" />
        </Link>
      </header>

      <form onSubmit={submit} className="flex-1 flex flex-col gap-6 pt-4">
        {!peek ? (
          <div className="relative flex flex-col items-center px-3 pt-4 anim-rise">
            <Sparkle className="absolute left-4 top-10 w-6 text-bone anim-pulse" />
            <Sparkle className="absolute right-6 top-4 w-5 text-bone/80 anim-pulse" style={{ animationDelay: "0.7s" }} />
            <Mascot mascots={mascots} pose="peek" index={0} className="w-32" />
            <h1 className="font-mono font-bold uppercase text-[2.6rem] leading-none mt-4 text-center">Join the game</h1>
          </div>
        ) : (
          <TitleLockup className="anim-rise" size="clamp(2.4rem, 12vw, 3.4rem)" />
        )}

        <div className="anim-rise px-3">
          <label className="sr-only" htmlFor="code">
            Room code
          </label>
          <input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4))}
            className="field text-center font-mono text-3xl tracking-[0.35em] uppercase"
            placeholder="Room code"
            autoCapitalize="characters"
            autoComplete="off"
          />
          {peek && (
            <p className="mt-3 text-sm text-center text-bone/80 anim-fade">
              For <span className="italic font-serif font-bold text-lg text-bone">{peek.honoree}</span> · {peek.players} in the room
            </p>
          )}
        </div>

        {usePortraits && (
          <section className="card px-4 py-5 anim-rise">
            <p className="font-mono font-semibold uppercase text-xl text-center mb-4 tracking-label">Pick your photo</p>
            <div className="grid grid-cols-3 gap-3">
              {profiles.map((p, i) => {
                const active = chosen === p.id;
                return (
                  <button
                    type="button"
                    key={p.id}
                    data-profile={p.id}
                    disabled={p.taken}
                    onClick={() => {
                      setChosen(p.id);
                      setName(p.name);
                      sfx.tap();
                    }}
                    className="text-left anim-rise disabled:cursor-not-allowed"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <Portrait photo={p.photo} name={p.name} dim={p.taken} className={active ? "outline outline-[3px] outline-acid" : ""}>
                      {active && <span className="absolute right-1.5 top-1.5 grid place-items-center w-7 h-7 rounded-full bg-acid text-ink text-sm font-bold">✓</span>}
                      {p.taken && <span className="chip absolute left-1.5 bottom-1.5">Ready</span>}
                    </Portrait>
                    <p className={`mt-1 text-sm text-center font-semibold truncate ${p.taken ? "text-bone/40" : active ? "text-acid" : ""}`}>{p.name}</p>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {(!usePortraits || picked) && (
          <div className="anim-rise px-3">
            <label className="label block mb-2" htmlFor="name">
              {usePortraits ? "Confirm your name" : "Your name"}
            </label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 20))}
              className="field text-center text-2xl font-semibold"
              placeholder="As your friends say it"
              autoComplete="given-name"
            />
          </div>
        )}

        {peek && !usePortraits && (
          <>
            <div className="anim-rise delay-2">
              <PhotoPicker photo={photo} name={name} onPick={async (f) => setPhoto(await squarePhoto(f))} />
            </div>
            <label className="flex items-start gap-3 text-sm text-bone/70 anim-rise delay-2 cursor-pointer">
              <input type="checkbox" checked={honoree} onChange={(e) => setHonoree(e.target.checked)} className="mt-1 accent-acid w-4 h-4" />
              <span>
                I’m the birthday girl.
                <span className="block text-bone/40">You’ll answer some questions privately. Everyone else guesses.</span>
              </span>
            </label>
          </>
        )}

        {error && <p className="text-rouge text-sm">{error}</p>}

        {(
          <button
            className="btn-primary mx-3 text-xl py-4 mt-auto"
            disabled={busy || code.length !== 4 || (usePortraits ? !chosen : !name.trim())}
          >
            {busy ? "Joining…" : !peek ? "Join" : usePortraits ? (picked ? "Continue" : "Pick your photo") : "Take a seat"}
          </button>
        )}
      </form>
    </main>
  );
}
