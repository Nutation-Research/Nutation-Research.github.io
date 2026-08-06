import { useState } from 'react'
import { Menu, X } from 'lucide-react'

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
  const [open, setOpen] = useState(false)
  return (
    <header className="border-b border-line relative">
      <div className="max-w-5xl mx-auto px-6 h-20 flex items-center gap-8">
        <a href="/" className="brand-lockup">
          <img src="/nutation-mark.png" alt="" draggable={false} className="brand-lockup-mark" />
          <span className="wordmark">Nutation Research</span>
        </a>
        <nav className="ml-auto hidden sm:flex items-center gap-7">
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
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="ml-auto sm:hidden text-ink p-1 -m-1"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      {open && (
        <nav className="sm:hidden border-t border-line bg-paper px-6 py-3 flex flex-col gap-1">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={`nav-link py-2 ${path === l.href ? 'active' : ''}`}
            >
              {l.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  )
}
