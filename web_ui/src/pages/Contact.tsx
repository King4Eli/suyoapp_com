import site from '../config/site.json'

function Contact() {
  const { supportEmail, safetyEmail } = site.contact

  return (
    <section className="legal">
      <h1>Contact</h1>
      <p>
        Questions, feedback, or need help with your account? We're happy to
        hear from you.
      </p>

      <h2>Support</h2>
      <p>
        Email <a href={`mailto:${supportEmail}`}>{supportEmail}</a> for
        account issues, billing questions, or bug reports.
      </p>

      <h2>Trust &amp; safety</h2>
      <p>
        To report a user, use the report option in the app. For anything
        else safety-related, email{' '}
        <a href={`mailto:${safetyEmail}`}>{safetyEmail}</a>.
      </p>
    </section>
  )
}

export default Contact
