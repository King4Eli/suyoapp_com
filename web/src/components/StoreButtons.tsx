import site from "../config/site.json";
import { AppleIcon, PlayStoreIcon } from "./Icons.tsx";

type Props = { inverted?: boolean };

function StoreButtons({ inverted = false }: Props) {
  const cls = `store-button${inverted ? " store-button-inverted" : ""}`;

  return (
    <div className="store-buttons">
      <a className={cls} href={site.app.ios.storeUrl}>
        <AppleIcon width={26} height={26} />
        <span>
          <small>Download on the</small>
          App Store
        </span>
      </a>
      <a className={cls} href={site.app.android.storeUrl}>
        <PlayStoreIcon width={24} height={24} />
        <span>
          <small>Get it on</small>
          Google Play
        </span>
      </a>
    </div>
  );
}

export default StoreButtons;
