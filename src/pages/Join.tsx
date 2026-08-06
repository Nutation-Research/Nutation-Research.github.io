import { Nav } from '../Nav';
import { Footer } from '../Footer';

const ROLES = [
  {
    title: 'Research Engineer, Pose & Motion',
    blurb: 'Pose estimation, kinematics, and the physics-grounded feature layer underneath Yuna.',
  },
  {
    title: 'Full-Stack Engineer',
    blurb: 'The canvas/telemetry viewer and coaching UI — precise, fast, and legible under real data.',
  },
  {
    title: 'Applied Researcher, Sports Judging',
    blurb: 'Turn ISU scoring rules into a model a skater can actually train against.',
  },
];

export function Join() {
  return (
    <div>
      <Nav />
      <main className="max-w-2xl mx-auto px-6 pt-20 pb-24">
        <h1 className="font-serif text-[36px] leading-tight tracking-[-0.01em] text-ink m-0">Join Us</h1>
        <p className="mt-6 text-[16px] leading-relaxed text-muted">
          We're a small team building from real competition data, not synthetic benchmarks. If
          you care about getting the physics right and the interface honest, we'd like to talk —
          even if nothing below is an exact match.
        </p>

        <div className="mt-12 flex flex-col gap-px rounded-xl border border-line overflow-hidden">
          {ROLES.map((r) => (
            <div key={r.title} className="bg-card px-5 py-4">
              <h3 className="text-[14px] font-semibold text-ink">{r.title}</h3>
              <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{r.blurb}</p>
            </div>
          ))}
        </div>

        <p className="mt-10 text-[15px] text-muted">
          Reach us at{' '}
          <a href="mailto:careers@nutationresearch.com" className="nav-link" style={{ textDecoration: 'underline' }}>
            careers@nutationresearch.com
          </a>
          .
        </p>
      </main>
      <Footer />
    </div>
  );
}
