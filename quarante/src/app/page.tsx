import Link from "next/link";
import { TitleLockup } from "@/components/ui";

export default function Home() {
  return (
    <main className="min-h-[100dvh] flex flex-col px-6 pt-8 pb-10 max-w-xl mx-auto">
      <header className="flex justify-between items-baseline">
        <span className="label">A private game</span>
        <span className="label">1986 – 2026</span>
      </header>

      <section className="flex-1 flex flex-col justify-center py-14">
        <p className="label mb-6 anim-rise">For Crystal’s fortieth</p>
        <TitleLockup className="anim-rise delay-1" size="clamp(4rem, 21vw, 9.5rem)" />
        <p className="font-serif italic text-2xl text-bone/60 mt-6 anim-rise delay-2">Forty questions. Four rounds. No further questions.</p>
      </section>

      <nav className="space-y-3 anim-rise delay-3">
        <Link href="/join" className="btn-acid w-full text-lg py-5">
          Join the game
        </Link>
        <Link href="/her" className="btn-ghost w-full py-4">
          I’m the birthday girl
        </Link>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/admin" className="btn-ghost">
            Host
          </Link>
          <Link href="/solo" className="btn-ghost">
            Pass &amp; play
          </Link>
        </div>
      </nav>
    </main>
  );
}
