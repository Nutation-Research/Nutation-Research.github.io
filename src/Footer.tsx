export function Footer() {
  return (
    <footer className="border-t border-line mt-24">
      <div className="max-w-5xl mx-auto px-6 py-10 flex items-center justify-between text-sm text-faint">
        <span>© {new Date().getFullYear()} Nutation Research</span>
        <a href="mailto:contact@nutationresearch.com" className="nav-link">
          contact@nutationresearch.com
        </a>
      </div>
    </footer>
  )
}
