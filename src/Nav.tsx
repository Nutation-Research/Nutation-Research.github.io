const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/about.html', label: 'About' },
  { href: '/products.html', label: 'Products' },
  { href: '/join.html', label: 'Join Us' },
]

function currentPath() {
  const p = window.location.pathname
  return p === '/index.html' ? '/' : p
}

export function Nav() {
  const path = currentPath()
  return (
    <header className="border-b border-line">
      <div className="max-w-5xl mx-auto px-6 h-20 flex items-center gap-8">
        <a href="/" className="brand-lockup">
          <img src="/nutation-mark.png" alt="" draggable={false} className="brand-lockup-mark" />
          <span className="wordmark">Nutation Research</span>
        </a>
        <nav className="ml-auto flex items-center gap-7">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={`nav-link ${path === l.href ? 'active' : ''}`}
            >
              {l.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  )
}
