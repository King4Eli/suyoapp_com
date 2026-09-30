import site from "../config/site.json";
import { CheckIcon } from "../components/Icons.tsx";

function PaymentBilling() {
  return (
    <section className="legal status-page">
      <div className="status-icon status-icon-success" aria-hidden="true">
        <CheckIcon width={30} height={30} />
      </div>
      <h1>Billing details saved</h1>
      <p>
        Any change to your payment method applies to your next renewal. If a
        renewal failed, we'll retry it with your updated details.
      </p>
      <a className="btn btn-primary status-cta" href={site.urls.site}>
        Open SuyoApp
      </a>
      <p className="status-hint">
        Didn't open automatically? Tap the button above, or open the app
        manually from your home screen.
      </p>
    </section>
  );
}

export default PaymentBilling;
