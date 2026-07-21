import site from '../config/site.json'

function Home() {
  const { hero, features } = site.home

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <h1>{hero.headline}</h1>
          <p>{hero.body}</p>
          <div className="hero-actions" id="download">
            <a className="store-button" href={site.app.ios.storeUrl}>
              {site.app.ios.downloadLabel}
            </a>
            <a
              className="store-button store-button-outline"
              href={site.app.android.storeUrl}
            >
              {site.app.android.downloadLabel}
            </a>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="hero-card hero-card-1" />
          <div className="hero-card hero-card-2" />
          <div className="hero-card hero-card-3" />
        </div>
      </section>

      <section className="features">
        {features.map((feature) => (
          <div className="feature-card" key={feature.title}>
            <h3>{feature.title}</h3>
            <p>{feature.body}</p>
          </div>
        ))}
      </section>
    </>
  )
}

export default Home
