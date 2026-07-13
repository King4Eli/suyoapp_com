import { Link, Outlet } from 'react-router-dom'
import site from './config/site.json'
import './styles.css'

function Layout() {
  return (
    <>
      <header className="nav">
        <div className="nav-inner">
          <Link className="logo" to="/">
            {site.brand.nameParts.base}
            <span className="logo-accent">{site.brand.nameParts.accent}</span>
          </Link>
          <a className="nav-cta" href="/#download">
            Get the app
          </a>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="footer">
        <span>
          &copy; {new Date().getFullYear()} {site.brand.name}
        </span>
        <div className="footer-links">
          {site.nav.footerLinks.map((link) => (
            <Link key={link.to} to={link.to}>
              {link.label}
            </Link>
          ))}
        </div>
      </footer>
    </>
  )
}

export default Layout
