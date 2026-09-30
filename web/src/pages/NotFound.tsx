import { Link } from "react-router-dom";
import site from "../config/site.json";
import { HeartIcon } from "../components/Icons.tsx";

function NotFound() {
  return (
    <section className="legal status-page">
      <div className="status-icon status-icon-brand" aria-hidden="true">
        <HeartIcon width={30} height={30} />
      </div>
      <h1>No match here</h1>
      <p>That page doesn't exist, but plenty of good things do.</p>
      <Link className="btn btn-primary status-cta" to={site.routes.home}>
        Back to homepage
      </Link>
    </section>
  );
}

export default NotFound;
