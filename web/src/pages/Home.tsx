import type { ComponentType, SVGProps } from "react";
import site from "../config/site.json";
import PhoneDeck from "../components/PhoneDeck.tsx";
import StoreButtons from "../components/StoreButtons.tsx";
import {
  ChatIcon,
  CheckIcon,
  LockIcon,
  PlaneIcon,
  RoseIcon,
  ShieldIcon,
  SparkIcon,
} from "../components/Icons.tsx";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

// Matched to site.home.features by index; extra features fall back to SparkIcon.
const featureStyles: { icon: Icon; tone: string }[] = [
  { icon: SparkIcon, tone: "rose" },
  { icon: ChatIcon, tone: "plum" },
  { icon: ShieldIcon, tone: "green" },
  { icon: LockIcon, tone: "ink" },
  { icon: PlaneIcon, tone: "plum" },
  { icon: RoseIcon, tone: "gold" },
];

function Home() {
  const { hero, how, features, safety, cta } = site.home;

  return (
    <>
      <section className="hero">
        <div className="hero-bg" aria-hidden="true" />
        <div className="hero-inner">
          <div className="hero-copy">
            <span className="eyebrow eyebrow-pill">
              <span className="dot" /> {hero.eyebrow}
            </span>
            <h1>
              {hero.headline}{" "}
              <span className="gradient-text">{hero.headlineAccent}</span>
            </h1>
            <p className="lead">{hero.body}</p>
            <div id="download">
              <StoreButtons />
            </div>
            <ul className="trust">
              {hero.trust.map((item) => (
                <li key={item}>
                  <CheckIcon width={16} height={16} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <PhoneDeck />
        </div>
      </section>

      <section className="section" id="how">
        <div className="section-head">
          <span className="eyebrow">{how.eyebrow}</span>
          <h2>{how.title}</h2>
        </div>
        <ol className="steps">
          {how.steps.map((step, i) => (
            <li className="step" key={step.title}>
              <span className="step-num">{i + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="section" id="features">
        <div className="section-head">
          <span className="eyebrow">{site.home.featuresEyebrow}</span>
          <h2>{site.home.featuresTitle}</h2>
        </div>
        <div className="bento">
          {features.map((feature, i) => {
            const { icon: FeatureIcon, tone } = featureStyles[i] ?? {
              icon: SparkIcon,
              tone: "rose",
            };
            return (
              <article className="feature" key={feature.title}>
                <span className={`feature-icon tone-${tone}`}>
                  <FeatureIcon width={22} height={22} />
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="section" id="safety">
        <div className="safety">
          <div className="safety-copy">
            <span className="eyebrow">{safety.eyebrow}</span>
            <h2>{safety.title}</h2>
            <p className="lead">{safety.body}</p>
          </div>
          <ul className="safety-list">
            {safety.points.map((point) => (
              <li key={point}>
                <span className="check">
                  <CheckIcon width={14} height={14} />
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section">
        <div className="cta-band">
          <div className="cta-copy">
            <img
              src="/favicon-192x192.png"
              alt=""
              width={72}
              height={72}
              className="cta-icon"
            />
            <h2>{cta.title}</h2>
            <p>{cta.body}</p>
          </div>
          <StoreButtons inverted />
        </div>
      </section>
    </>
  );
}

export default Home;
