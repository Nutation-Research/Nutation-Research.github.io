import { Nav } from '../Nav';
import { Footer } from '../Footer';
import { HomeCoachDemo } from '../coach/HomeCoachDemo';

export function Home() {
  return (
    <div>
      <Nav />
      <main className="max-w-5xl mx-auto px-6">
        <section className="pt-20 pb-14 max-w-2xl">
          <h1 className="font-serif text-[44px] leading-[1.08] tracking-[-0.01em] text-ink m-0">
            A world model for human movement.
          </h1>
          <p className="mt-5 text-[17px] leading-relaxed text-muted max-w-xl">
            Nutation Research is building a world model for sports to enhance human physical
            capabilities. We automatically evaluate your specific mechanics and provide pointed
            interpretability behind our evaluations so you can quickly improve. Our first product,
            Yuna, does this for figure skating — reading a program frame by frame and explaining a
            score the way a judge would.
          </p>
          <p className="mt-4 text-[14px] leading-relaxed text-faint max-w-xl">
            Breakthroughs like the Fosbury Flop and the jump shot changed what humans could do by
            finding a better movement hidden in a vast search space. We're building a model that
            can search that space systematically.
          </p>
          <div className="mt-8 flex items-center gap-4">
            <a href="/products.html" className="pill-link">See Yuna</a>
            <a href="/about.html" className="nav-link">About the research →</a>
          </div>
        </section>

        <section id="demo" className="pb-24 scroll-mt-24">
          <div className="mb-4 flex items-baseline justify-between">
            <span className="microlabel">Live demo</span>
            <span className="text-[13px] text-faint">Real pose data, real ISU scoring — Milano Cortina 2026</span>
          </div>
          <HomeCoachDemo />
        </section>
      </main>
      <Footer />
    </div>
  );
}
