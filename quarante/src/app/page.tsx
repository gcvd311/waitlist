"use client";
import Link from "next/link";
import { Mascot, TitleLockup } from "@/components/ui";
import { Sparkle } from "@/components/Cat";
import { usePublic } from "@/hooks/usePublic";

export default function Home() {
  const { name, mascots } = usePublic();
  return (
    <main className="min-h-[100dvh] flex flex-col max-w-md mx-auto overflow-hidden">
      <section className="relative flex-1 flex flex-col items-center justify-center px-6 pt-10">
        <Sparkle className="absolute left-8 top-16 w-9 text-bone anim-pulse" />
        <Sparkle className="absolute left-16 top-40 w-5 text-bone/80 anim-pulse" style={{ animationDelay: "0.5s" }} />
        <Sparkle className="absolute right-8 top-28 w-7 text-bone anim-pulse" style={{ animationDelay: "0.9s" }} />
        <Mascot mascots={mascots} pose="peek" className="w-44 -mb-6 relative z-10 anim-rise" />
        <TitleLockup className="anim-rise delay-1" size="clamp(3.6rem, 19vw, 6rem)" />
        <p className="font-serif italic font-bold text-[1.7rem] leading-tight text-center mt-6 anim-rise delay-2">
          {name} turns 40.
          <br />
          We have questions.
        </p>
        <div className="w-full mt-10 space-y-3 anim-rise delay-3">
          <Link href="/join" className="btn-primary w-full text-xl py-4">
            Join game
          </Link>
          <div className="grid grid-cols-3 gap-2">
            <Link href="/her" className="btn-ghost btn-sm">
              Birthday girl
            </Link>
            <Link href="/admin" className="btn-ghost btn-sm">
              Host
            </Link>
            <Link href="/solo" className="btn-ghost btn-sm">
              One phone
            </Link>
          </div>
        </div>
      </section>
      <div className="leopard h-16 mt-10 rounded-t-[40%_100%]" />
    </main>
  );
}
