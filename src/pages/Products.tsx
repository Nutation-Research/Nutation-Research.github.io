import { Nav } from '../Nav';
import { Footer } from '../Footer';

export function Products() {
  return (
    <div>
      <Nav />
      <main className="max-w-3xl mx-auto px-6 pt-20 pb-24">
        <span className="microlabel">Products</span>
        <div className="mt-3 flex items-center gap-3">
          <img src="/yuna-mark.png" alt="" draggable={false} className="h-10 w-auto" />
          <h1 className="font-serif text-[36px] leading-tight tracking-[-0.01em] text-ink m-0">Yuna</h1>
        </div>
        <p className="mt-2 text-[13px] text-faint">Browser research preview</p>

        <p className="mt-6 text-[16px] leading-relaxed text-muted max-w-xl">
          Yuna reads a figure skating program frame by frame — pose, jumps, spins, edges — and
          turns it into the kind of read a technical panel gives: what earned a bullet, what
          didn't, and why. Point it at a clip and it builds the skeleton, the jump arcs, and the
          scoring narrative underneath.
        </p>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <h3 className="text-[13px] font-semibold text-ink">Per-frame pose</h3>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
              15-joint skeleton, center of mass, and rotational axis extracted from raw video.
            </p>
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-ink">Jump &amp; spin detection</h3>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
              Height, air time, rotation count, and take-off/landing edges — measured, not guessed.
            </p>
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-ink">Coach</h3>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
              A bullet-by-bullet GOE read against the real ISU +GOE guidelines, illustrated on a
              motion trail built from the skater's own pose.
            </p>
          </div>
        </div>

        <div className="mt-12">
          <a href="/#demo" className="pill-link">Try the Coach demo</a>
        </div>

        <p className="mt-14 text-[13px] text-faint max-w-xl">
          Yuna is an early research preview — the coaching layer is hand-authored for a small set
          of elements today, with a learned coach in progress. Scores shown are cross-checked
          against published competition protocols.
        </p>
      </main>
      <Footer />
    </div>
  );
}
