import Link from "next/link";
import { Wordmark } from "@/components/ui";

export default function Home() {
  return (
    <main className="min-h-[100dvh] flex flex-col px-6 pt-8 pb-10 max-w-xl mx-auto">
      <header className="flex justify-between items-baseline">
        <Wordmark className="text-2xl" />
        <span className="label">A private game</span>
      </header>

      <section className="flex-1 flex flex-col justify-center py-16">
        <p className="label mb-6 anim-rise">For a fortieth</p>
        <h1 className="display text-[19vw] sm:text-[7.5rem] anim-rise delay-1">
          Forty<span className="italic text-acid">,</span>
          <br />
          <span className="italic">and still</span>
          <br />
          the question.
        </h1>
      </section>

      <nav className="space-y-3 anim-rise delay-3">
        <Link href="/join" className="btn-acid w-full text-lg py-5">
          Join a game
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
