import { Link } from "react-router-dom";
import site from "../config/site.json";

function NotFound() {
  return (
    <section className="legal">
      <h1>Page not found</h1>
      <p>
        That page doesn't exist. Head back to the{" "}
        <Link to={site.routes.home}>homepage</Link>.
      </p>
    </section>
  );
}

export default NotFound;
