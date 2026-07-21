import { Link } from 'react-router-dom'
import site from '../config/site.json'

function Terms() {
  return (
    <section className="legal">
      <h1>Terms of Service</h1>
      <p className="legal-updated">Last updated: {site.legal.lastUpdated}</p>

      <p>
        These Terms govern your use of SuyoApp. By creating an account, you
        agree to them.
      </p>

      <h2>Eligibility</h2>
      <p>
        You must be at least 18 years old and able to form a binding
        contract to use SuyoApp. You must verify your account with a valid
        phone number.
      </p>

      <h2>Your conduct</h2>
      <ul>
        <li>Be honest — use real photos and accurate information.</li>
        <li>No harassment, hate speech, threats, or impersonation.</li>
        <li>No soliciting, spamming, or commercial activity.</li>
        <li>No sharing content you don't have the right to share.</li>
      </ul>
      <p>
        We may suspend or terminate accounts that violate these rules, and
        you can block or report anyone who does.
      </p>

      <h2>Subscriptions and purchases</h2>
      <p>
        Some features are offered as paid subscriptions or one-time
        consumable purchases, billed through our payment processor.
        Subscriptions renew automatically until cancelled. Consumable
        purchases are granted to your account once payment is confirmed.
        Refunds are handled case by case — contact us if something went
        wrong with a purchase.
      </p>

      <h2>Content</h2>
      <p>
        You keep ownership of what you post. By posting content, you grant
        us the license needed to store, display, and transmit it so the app
        can function — for example, showing your photos to other users.
      </p>

      <h2>Termination</h2>
      <p>
        You can delete your account at any time. We may suspend or remove
        accounts that violate these Terms or put other users at risk.
      </p>

      <h2>Disclaimer</h2>
      <p>
        SuyoApp is provided "as is." We don't guarantee you'll find a match,
        and we're not responsible for the conduct of other users, on or off
        the app. Meet people safely and use your own judgment.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these Terms from time to time. Continued use of the
        app after changes means you accept the updated Terms.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these Terms? Reach us on the{' '}
        <Link to={site.routes.contact}>Contact</Link> page.
      </p>
    </section>
  )
}

export default Terms
