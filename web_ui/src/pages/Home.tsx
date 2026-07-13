import site from '../config/site.json'

const FEATURES = [
  {
    title: 'Smart matches',
    body: 'We surface people who actually fit what you’re looking for, not just who’s nearby.',
  },
  {
    title: 'Real conversations',
    body: 'Chat, share photos, and send voice notes the moment you match — no waiting around.',
  },
  {
    title: 'Verified profiles',
    body: 'Phone-verified sign-in and moderation keep the people you meet real.',
  },
  {
    title: 'Your privacy first',
    body: 'Block and report anyone, anytime. You’re always in control of who can reach you.',
  },
]

function Home() {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <h1>Find your next favorite person.</h1>
          <p>
            Sign in with your phone number to start matching, chatting, and
            meeting people who are actually worth your time.
          </p>
          <div className="hero-actions" id="download">
            <a className="store-button" href={site.app.ios.storeUrl}>
              Download on the App Store
            </a>
            <a
              className="store-button store-button-outline"
              href={site.app.android.storeUrl}
            >
              Get it on Google Play
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
        {FEATURES.map((feature) => (
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
