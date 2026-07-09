import { Link, Outlet } from 'react-router-dom'
import './styles.css'

function Layout() {
  return (
    <>
      <header className="nav">
        <div className="nav-inner">
          <Link className="logo" to="/">
            suyo<span className="logo-accent">app</span>
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
        <span>&copy; {new Date().getFullYear()} SuyoApp</span>
        <div className="footer-links">
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/contact">Contact</Link>
        </div>
      </footer>
    </>
  )
}

export default Layout
