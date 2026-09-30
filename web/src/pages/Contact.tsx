import site from "../config/site.json";
import { ChatIcon, ShieldIcon } from "../components/Icons.tsx";

function Contact() {
  const {
    supportEmail,
    safetyEmail,
    headline,
    supportTitle,
    supportBody,
    safetyTitle,
    safetyBody,
  } = site.contact;

  return (
    <section className="legal">
      <span className="eyebrow">Get in touch</span>
      <h1>Contact us</h1>
      <p>{headline}</p>

      <div className="contact-grid">
        <div className="contact-card">
          <span className="feature-icon tone-rose">
            <ChatIcon width={22} height={22} />
          </span>
          <h2>{supportTitle}</h2>
          <p>{supportBody.replace("{email}", supportEmail)}</p>
          <a className="btn btn-primary btn-sm" href={`mailto:${supportEmail}`}>
            {supportEmail}
          </a>
        </div>

        <div className="contact-card">
          <span className="feature-icon tone-green">
            <ShieldIcon width={22} height={22} />
          </span>
          <h2>{safetyTitle}</h2>
          <p>{safetyBody.replace("{email}", safetyEmail)}</p>
          <a className="btn btn-primary btn-sm" href={`mailto:${safetyEmail}`}>
            {safetyEmail}
          </a>
        </div>
      </div>
    </section>
  );
}

export default Contact;
