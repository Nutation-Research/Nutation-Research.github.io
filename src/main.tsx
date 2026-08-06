import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import { Home } from './pages/Home'
import { About } from './pages/About'
import { Products } from './pages/Products'
import { Join } from './pages/Join'

function pageForPath(pathname: string) {
  const p = pathname.replace(/\/index\.html$/, '/').replace(/\.html$/, '')
  if (p.endsWith('/about')) return <About />
  if (p.endsWith('/products')) return <Products />
  if (p.endsWith('/join')) return <Join />
  return <Home />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>{pageForPath(window.location.pathname)}</StrictMode>,
)
