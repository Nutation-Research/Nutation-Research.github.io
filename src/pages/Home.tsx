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
            AI systems that understand human movement.
          </h1>
          <p className="mt-5 text-[17px] leading-relaxed text-muted max-w-xl">
            Nutation Research builds models that watch, measure, and coach elite athletic
            technique — starting with figure skating. Our first product, Yuna, reads a skater's
            pose frame by frame and explains a jump the way a judge would.
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
