import site from '../config/site.json'

function Contact() {
  const { supportEmail, safetyEmail, headline, supportTitle, supportBody, safetyTitle, safetyBody } = site.contact

  return (
    <section className="legal">
      <h1>Contact</h1>
      <p>{headline}</p>

      <h2>{supportTitle}</h2>
      <p>
        <a href={`mailto:${supportEmail}`}>{supportEmail}</a>{' '}
        {supportBody.replace('{email}', supportEmail)}
      </p>

      <h2>{safetyTitle}</h2>
      <p>
        {safetyBody.replace('{email}', safetyEmail)}{' '}
        <a href={`mailto:${safetyEmail}`}>{safetyEmail}</a>.
      </p>
    </section>
  )
}

export default Contact
