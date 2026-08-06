import { Nav } from '../Nav';
import { Footer } from '../Footer';

export function Join() {
  return (
    <div>
      <Nav />
      <main className="max-w-2xl mx-auto px-6 pt-20 pb-24">
        <h1 className="font-serif text-[36px] leading-tight tracking-[-0.01em] text-ink m-0">Join Us</h1>
        <p className="mt-6 text-[16px] leading-relaxed text-muted">
          We're a small team building from real competition data, not synthetic benchmarks. If
          you care about getting the physics right and the interface honest, we'd like to talk.
        </p>
        <p className="mt-5 text-[16px] leading-relaxed text-muted">
          We're looking to expand our team. If you're interested, send your resume to{' '}
          <a href="mailto:contact@nutationresearch.com" className="nav-link" style={{ textDecoration: 'underline' }}>
            contact@nutationresearch.com
          </a>
          .
        </p>
      </main>
      <Footer />
    </div>
  );
}
