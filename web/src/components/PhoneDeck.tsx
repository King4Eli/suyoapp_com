import {
  HeartIcon,
  PinIcon,
  PlayIcon,
  RoseIcon,
  VerifiedIcon,
  XIcon,
} from "./Icons.tsx";

// Decorative mock of the app's swipe deck. Portraits are drawn in the same
// soft round-figure style as the app icon rather than using stock photos.
function Portrait({ hue }: { hue: "rose" | "peach" | "plum" }) {
  return (
    <div className={`portrait portrait-${hue}`}>
      <svg viewBox="0 0 200 260" preserveAspectRatio="xMidYMax meet">
        <circle cx="100" cy="112" r="46" fill="rgba(255,255,255,0.9)" />
        <path
          d="M28 270c0-52 32-86 72-86s72 34 72 86Z"
          fill="rgba(255,255,255,0.78)"
        />
        <path
          d="M84 116c4-5 12-5 16 0M108 116c4-5 12-5 16 0"
          stroke="rgba(178,63,160,0.55)"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </div>
  );
}

function PhoneDeck() {
  return (
    <div className="deck" aria-hidden="true">
      <div className="deck-glow" />

      <div className="phone">
        <div className="phone-notch" />
        <div className="phone-screen">
          <div className="phone-top">
            <img src="/favicon-96x96.png" alt="" width={26} height={26} />
            <span className="phone-tabs">
              <b>For you</b>
              <span>Nearby</span>
            </span>
          </div>

          <div className="cards">
            <div className="card card-back-2" />
            <div className="card card-back-1">
              <Portrait hue="plum" />
            </div>
            <div className="card card-front">
              <Portrait hue="rose" />
              <span className="stamp stamp-like">LIKE</span>
              <div className="card-info">
                <div className="card-name">
                  Amara, 27
                  <VerifiedIcon width={20} height={20} className="verified" />
                </div>
                <div className="card-meta">
                  <PinIcon width={14} height={14} /> 3 miles away
                </div>
                <div className="chips">
                  <span>☕ Coffee</span>
                  <span>🎧 Afrobeats</span>
                  <span>✈️ Travel</span>
                </div>
              </div>
            </div>
          </div>

          <div className="actions">
            <span className="action action-pass">
              <XIcon width={24} height={24} />
            </span>
            <span className="action action-rose">
              <RoseIcon width={20} height={20} />
            </span>
            <span className="action action-like">
              <HeartIcon width={26} height={26} />
            </span>
          </div>
        </div>
      </div>

      <div className="float float-match">
        <span className="avatars">
          <span className="mini mini-rose" />
          <span className="mini mini-plum" />
        </span>
        <span>
          <b>It's a match!</b>
          <small>You and Amara liked each other</small>
        </span>
      </div>

      <div className="float float-rose">
        <span className="float-icon">
          <RoseIcon width={18} height={18} />
        </span>
        <span>
          <b>Daniel sent you a rose</b>
          <small>Just now</small>
        </span>
      </div>

      <div className="float float-voice">
        <span className="voice-play">
          <PlayIcon width={14} height={14} />
        </span>
        <span className="wave">
          {[6, 12, 18, 10, 16, 8, 14, 20, 12, 6, 10, 16, 8].map((h, i) => (
            <i key={i} style={{ height: h }} />
          ))}
        </span>
        <small>0:12</small>
      </div>
    </div>
  );
}

export default PhoneDeck;
