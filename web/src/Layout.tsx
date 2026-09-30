import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import site from "./config/site.json";
import ThemeToggle from "./components/ThemeToggle.tsx";
import "./styles.css";

function Logo() {
  return (
    <Link className="logo" to={site.routes.home}>
      {site.brand.logo.imagePath && (
        <img src={site.brand.logo.imagePath} alt="" width={36} height={36} />
      )}
      <span>
        {site.brand.nameParts.base}
        <span className="logo-accent">{site.brand.nameParts.accent}</span>
      </span>
    </Link>
  );
}

function Layout() {
  const { pathname, hash } = useLocation();
  const [scrolled, setScrolled] = useState(false);

  // React Router doesn't scroll to #anchors or reset scroll on navigation.
  useEffect(() => {
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView();
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname, hash]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header className={`nav${scrolled ? " nav-scrolled" : ""}`}>
        <div className="nav-inner">
          <Logo />
          <nav className="nav-links" aria-label="Primary">
            {site.nav.links.map((link) => (
              <Link key={link.to} to={link.to}>
                {link.label}
              </Link>
            ))}
          </nav>
          <ThemeToggle />
          <Link
            className="btn btn-primary btn-sm"
            to={site.routes.downloadAnchor}
          >
            {site.nav.headerCtaLabel}
          </Link>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <Logo />
            <p>{site.brand.tagline}</p>
          </div>
          <div className="footer-links">
            {site.nav.footerLinks.map((link) => (
              <Link key={link.to} to={link.to}>
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            &copy; {new Date().getFullYear()} {site.brand.name}. For adults 18+.
          </span>
          <a href={`mailto:${site.contact.supportEmail}`}>
            {site.contact.supportEmail}
          </a>
        </div>
      </footer>
    </>
  );
}

export default Layout;
