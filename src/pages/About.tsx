import { Nav } from '../Nav';
import { Footer } from '../Footer';

export function About() {
  return (
    <div>
      <Nav />
      <main className="max-w-2xl mx-auto px-6 pt-20 pb-24">
        <h1 className="font-serif text-[36px] leading-tight tracking-[-0.01em] text-ink m-0">About</h1>
        <p className="mt-6 text-[16px] leading-relaxed text-muted">
          Nutation Research is a small lab working on machine perception of elite human movement.
          We started with figure skating: a sport where technique is judged frame by frame, and
          where the gap between "looks right" and "is right" is measured in degrees and
          milliseconds.
        </p>
        <p className="mt-5 text-[16px] leading-relaxed text-muted">
          Our name comes from nutation — the small wobble in a spinning body's axis, the same
          physics that governs a gyroscope, a top, and a skater mid-rotation. It's a fitting name
          for a lab studying the physics of the body in motion.
        </p>
        <p className="mt-5 text-[16px] leading-relaxed text-muted">
          We build from real competition footage and real pose data, cross-checked against
          published ISU protocols — not synthetic benchmarks. If a number is on our site, we can
          show you where it came from.
        </p>
        <h2 className="mt-14 font-serif text-[22px] text-ink">What we're working on</h2>
        <p className="mt-4 text-[16px] leading-relaxed text-muted">
          Pose estimation, jump and spin detection, and a coaching layer that explains a score the
          way a technical panel would — element by element, bullet by bullet. Figure skating is
          the proving ground; the underlying models generalize to any sport judged on technique.
        </p>
      </main>
      <Footer />
    </div>
  );
}
