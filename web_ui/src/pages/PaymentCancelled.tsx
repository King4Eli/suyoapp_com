function PaymentCancelled() {
  return (
    <section className="legal status-page">
      <div className="status-icon status-icon-cancel" aria-hidden="true">
        ✕
      </div>
      <h1>Payment cancelled</h1>
      <p>
        No charge was made. You can pick a plan again anytime from inside the
        app.
      </p>
      <a className="store-button status-cta" href="https://suyoapp.com/payment/cancelled">
        Open SuyoApp
      </a>
      <p className="status-hint">
        Didn't open automatically? Tap the button above, or open the app
        manually from your home screen.
      </p>
    </section>
  )
}

export default PaymentCancelled
