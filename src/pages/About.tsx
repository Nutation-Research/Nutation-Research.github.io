import { Nav } from '../Nav';
import { Footer } from '../Footer';

export function About() {
  return (
    <div>
      <Nav />
      <main className="max-w-2xl mx-auto px-6 pt-20 pb-24">
        <h1 className="font-serif text-[36px] leading-tight tracking-[-0.01em] text-ink m-0">About</h1>
        <p className="mt-6 text-[16px] leading-relaxed text-muted">
          Athletic performance often turns on subtle changes in timing, balance, angle, and
          force — but that knowledge is mostly locked inside experienced coaches. Athletes can
          tell when a movement went wrong, but not always precisely why, or what to do
          differently.
        </p>
        <p className="mt-5 text-[16px] leading-relaxed text-muted">
          We're building a world model for sports: it evaluates your mechanics, searches
          physically plausible variations of a movement, and shows you the best one — with the
          specific actions to get there. Breakthroughs like the Fosbury Flop and the jump shot
          changed what's possible in their sports by finding a better movement hidden in a vast
          search space. We think that space can be searched systematically.
        </p>
        <p className="mt-5 text-[16px] leading-relaxed text-muted">
          We started with figure skating, where every element is scored in detail and tiny
          biomechanical differences separate a fall from a medal. Scores are precise, but the
          reasoning behind them is rarely explained — to athletes or to viewers. Our first
          product, Yuna, reads a program frame by frame and explains a score the way a technical
          panel would.
        </p>
        <p className="mt-5 text-[16px] leading-relaxed text-muted">
          Our name comes from nutation — the small wobble in a spinning body's axis, the same
          physics that governs a gyroscope, a top, and a skater mid-rotation.
        </p>
        <h2 className="mt-14 font-serif text-[22px] text-ink">What we're working on</h2>
        <p className="mt-4 text-[16px] leading-relaxed text-muted">
          Figure skating is our proving ground — every element is scored in enough detail to
          check our work against real, published results. The same underlying model of human
          motion generalizes across sports; we're scaling it next.
        </p>
      </main>
      <Footer />
    </div>
  );
}
