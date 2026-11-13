"use client";
import type { AwardsView, Nominee } from "@/lib/types";
import { Portrait, Sticker } from "@/components/ui";
import { Sparkle } from "@/components/Cat";

const TIER = {
  1: { label: "Gold", metal: "metal-gold", roman: "I", step: 3 },
  2: { label: "Silver", metal: "metal-silver", roman: "II", step: 2 },
  3: { label: "Bronze", metal: "metal-bronze", roman: "III", step: 1 },
} as const;

/** A small struck medal: metal disc, Roman numeral. */
function Medal({ place, size }: { place: 1 | 2 | 3; size: number }) {
  return (
    <span
      className={`grid place-items-center rounded-full ${TIER[place].metal} shadow-[0_6px_14px_-4px_rgba(40,0,6,0.6),inset_0_0_0_2px_rgba(255,255,255,0.35)] font-serif font-bold text-[rgb(60_8_14)]`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {TIER[place].roman}
    </span>
  );
}

const nominations = (n: number) => `${n} nomination${n === 1 ? "" : "s"}`;
const names = (ps: Nominee[]) => (ps.length === 1 ? ps[0].name : ps.length === 2 ? `${ps[0].name} & ${ps[1].name}` : `${ps.slice(0, -1).map((p) => p.name).join(", ")} & ${ps[ps.length - 1].name}`);

/**
 * GUILTY AS CHARGED: Silver, Gold, Bronze, left to right.
 * Bronze is revealed first, then Silver, then Gold. Equal totals share a step.
 */
export function AwardsPodium({ awards, large = false }: { awards: AwardsView; large?: boolean }) {
  const byPlace = (p: 1 | 2 | 3) => awards.tiers.find((t) => t.place === p);
  const order: (1 | 2 | 3)[] = [2, 1, 3];
  const heights = large ? { 1: "h-[13vh]", 2: "h-[9vh]", 3: "h-[6vh]" } : { 1: "h-20", 2: "h-14", 3: "h-10" };
  const photoW = large ? { 1: "min(11vw, 18vh)", 2: "min(8.5vw, 14vh)", 3: "min(8.5vw, 14vh)" } : { 1: "5.6rem", 2: "4.6rem", 3: "4.6rem" };

  return (
    <div className={`grid grid-cols-3 items-end ${large ? "gap-6 lg:gap-10 max-w-6xl pt-12" : "gap-2 pt-6"} w-full mx-auto`}>
      {order.map((place) => {
        const tier = byPlace(place);
        const shown = awards.step >= TIER[place].step && !!tier;
        const gold = place === 1;
        const n = tier?.people.length ?? 1;
        return (
          <div key={place} className="flex flex-col items-center min-w-0">
            {shown && tier ? (
              <div key={`in-${place}`} className={`relative flex flex-col items-center text-center w-full ${gold ? "anim-coronate" : "anim-rise"}`}>
                {gold && <span className="absolute inset-x-[10%] top-[8%] bottom-[30%] rounded-full bg-gold/30 blur-2xl anim-halo" aria-hidden />}
                {gold && <Sparkle className={`absolute ${large ? "-left-2 top-6 w-8" : "-left-1 top-3 w-4"} text-gold anim-pulse`} />}
                {gold && <Sparkle className={`absolute ${large ? "right-0 top-24 w-6" : "right-0 top-10 w-3"} text-gold anim-pulse`} style={{ animationDelay: "0.7s" }} />}
                <div className="relative flex justify-center gap-2 w-full">
                  {tier.people.map((p) => (
                    <div key={p.id} className="relative min-w-0" style={{ width: `calc(${photoW[place]} / ${Math.min(n, 3) ** 0.75})` }}>
                      {gold && <Sticker name="crown" className="absolute left-1/2 z-10 anim-crown" style={{ top: large ? "-2.9rem" : "-1.5rem", width: large ? "5.5rem" : "2.8rem" }} />}
                      <Portrait photo={p.photo} name={p.name} className={`${gold ? "ring-[5px] ring-gold" : place === 2 ? "ring-4 ring-[#d9dce2]" : "ring-4 ring-[#c98a52]"}`} />
                    </div>
                  ))}
                  <span className={`absolute ${large ? "-bottom-5 -right-1" : "-bottom-3 -right-1"} z-10`}>
                    <Medal place={place} size={large ? (gold ? 64 : 52) : gold ? 34 : 28} />
                  </span>
                </div>
                <p className={`mt-4 font-mono font-bold uppercase leading-tight truncate max-w-full ${large ? (gold ? "text-[clamp(1.4rem,2.4vw,2.4rem)]" : "text-[clamp(1.1rem,1.8vw,1.8rem)]") : gold ? "text-base" : "text-[13px]"}`}>
                  {names(tier.people)}
                </p>
                <p className={`font-mono uppercase tracking-label ${large ? "text-sm" : "text-[10px]"} text-bone/70`}>
                  {n > 1 ? `Tied · ${nominations(tier.votes)} each` : nominations(tier.votes)}
                </p>
                {n === 1 && tier.people[0].top[0] && (
                  <p className={`font-serif italic leading-snug mt-1 ${large ? "text-[clamp(0.9rem,1.2vw,1.2rem)] max-w-[28ch]" : "text-[11px]"} text-bone/85 line-clamp-3`}>
                    Most accused of: {tier.people[0].top[0].label}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-end w-full" style={{ minHeight: large ? "16rem" : "7rem" }}>
                <span className={`grid place-items-center rounded-2xl border-2 border-dashed border-bone/25 text-bone/35 font-serif italic ${large ? "w-28 h-36 text-5xl" : "w-14 h-[4.5rem] text-2xl"}`}>
                  {tier || awards.step < TIER[place].step ? "?" : "–"}
                </span>
              </div>
            )}
            {/* the step itself */}
            <div className={`relative w-full mt-4 ${heights[place]} rounded-t-xl bg-bone text-ink overflow-hidden shadow-[0_20px_40px_-20px_rgba(40,0,6,0.8)]`}>
              <span className={`absolute inset-x-0 top-0 ${large ? "h-2" : "h-1"} ${TIER[place].metal}`} />
              <span className={`absolute inset-0 grid place-items-center font-mono font-bold uppercase tracking-label ${large ? "text-[clamp(0.9rem,1.4vw,1.4rem)]" : "text-[10px]"}`}>
                {TIER[place].label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Each winner's three most-nominated questions. */
export function Evidence({ awards, large = false }: { awards: AwardsView; large?: boolean }) {
  return (
    <div className={`grid gap-6 ${large ? "md:grid-cols-3" : ""}`}>
      {[...awards.tiers].map((t) =>
        t.people.map((p) => (
          <div key={p.id} className="min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <Medal place={t.place} size={large ? 34 : 26} />
              <p className={`font-mono font-bold uppercase truncate ${large ? "text-xl" : "text-base"}`}>{p.name}</p>
            </div>
            <ol className="space-y-1.5">
              {p.top.map((c, i) => (
                <li key={i} className={`flex gap-3 items-baseline border-b border-bone/10 pb-1.5 ${large ? "text-lg" : "text-sm"}`}>
                  <span className="flex-1 font-serif italic leading-snug">{c.label}</span>
                  <span className="font-mono tabular-nums shrink-0">{c.votes}</span>
                </li>
              ))}
            </ol>
          </div>
        )),
      )}
    </div>
  );
}

/** Everyone, by total nominations. Ties share a place. */
export function FullRankings({ awards, large = false }: { awards: AwardsView; large?: boolean }) {
  const shared = (r: number) => awards.ranking.filter((p) => p.rank === r).length > 1;
  return (
    <ol className={`grid gap-x-10 gap-y-2 ${large && awards.ranking.length > 6 ? "md:grid-cols-2" : ""}`}>
      {awards.ranking.map((p) => (
        <li key={p.id} className={`flex items-center gap-3 border-b border-bone/10 pb-2 ${large ? "text-xl" : "text-base"}`}>
          <span className="font-mono tabular-nums w-9 text-bone/60">{shared(p.rank) ? `=${p.rank}` : p.rank}</span>
          <span className={`${large ? "w-12" : "w-9"} shrink-0`}>
            <Portrait photo={p.photo} name={p.name} />
          </span>
          <span className="flex-1 font-semibold truncate">{p.name}</span>
          <span className="font-mono tabular-nums">{p.votes}</span>
        </li>
      ))}
    </ol>
  );
}

export function AwardsTitle({ large = false, step }: { large?: boolean; step: number }) {
  return (
    <div className="relative text-center">
      <Sparkle className={`absolute ${large ? "left-[22%] -top-1 w-9" : "left-2 top-0 w-5"} text-bone/80 anim-pulse`} />
      <Sparkle className={`absolute ${large ? "right-[24%] top-10 w-6" : "right-3 top-6 w-3"} text-bone/60 anim-pulse`} style={{ animationDelay: "0.8s" }} />
      <p className={`font-mono uppercase tracking-label text-bone/70 ${large ? "text-sm mb-2" : "text-[10px] mb-1"}`}>Most Likely To · the verdicts</p>
      <h1 className={`title-face -rotate-[2deg] leading-none ${large ? (step === 0 ? "text-[clamp(3.6rem,8vw,8rem)]" : "text-[clamp(2.6rem,5vw,5rem)]") : "text-[2.4rem]"} transition-all duration-700`}>
        Guilty as Charged
      </h1>
      {step === 0 && <p className={`font-serif italic ${large ? "text-[clamp(1.2rem,2vw,2rem)] mt-5" : "text-base mt-3"} text-bone/80 anim-rise delay-3`}>Three nominees. No appeals.</p>}
      <Sticker name="bow" className={`absolute ${large ? "-top-6 right-[14%] w-20" : "-top-3 right-0 w-10"} rotate-12`} />
    </div>
  );
}
