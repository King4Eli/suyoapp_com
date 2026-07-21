import site from '../config/site.json'

function PaymentSuccess() {
  return (
    <section className="legal status-page">
      <div className="status-icon status-icon-success" aria-hidden="true">
        ✓
      </div>
      <h1>Payment successful</h1>
      <p>
        Your purchase is confirmed. Head back to the SuyoApp app to see it
        reflected on your profile.
      </p>
      <a className="store-button status-cta" target="_blank" rel="noopener noreferrer" href={site.urls.site}>
        Open SuyoApp
      </a>
      <p className="status-hint">
        Didn't open automatically? Tap the button above, or open the app
        manually from your home screen.
      </p>
    </section>
  )
}

export default PaymentSuccess
