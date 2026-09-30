import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = (props: IconProps): IconProps => ({
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  ...props,
});

export const HeartIcon = (props: IconProps) => (
  <svg {...base(props)} fill="currentColor" stroke="none">
    <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.8 4.5c2.1 0 3.6 1.1 4.4 2.4h1.6c.8-1.3 2.3-2.4 4.4-2.4 3.8 0 5.9 3.9 4.4 7.3C19.5 16.4 12 21 12 21Z" />
  </svg>
);

export const XIcon = (props: IconProps) => (
  <svg {...base(props)} strokeWidth={2.6}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const RoseIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M12 3c-2.5 0-4.5 1.8-4.5 4.4 0 2.6 2 4.6 4.5 4.6s4.5-2 4.5-4.6C16.5 4.8 14.5 3 12 3Z" />
    <path d="M9.5 5.5c1 .9 2.5 1.2 3.8.4M12 12v9M12 17c-1.6-1.8-3.6-2.1-5-1.5 1 1.8 3 2.4 5 1.5ZM12 15.5c1.4-1.4 3.2-1.6 4.5-1-.9 1.5-2.7 2-4.5 1Z" />
  </svg>
);

export const ChatIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.4L3 21l1.9-5.3A8.4 8.4 0 1 1 21 11.5Z" />
  </svg>
);

export const ShieldIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M12 3 4.5 6v5.4c0 4.6 3.2 8.4 7.5 9.6 4.3-1.2 7.5-5 7.5-9.6V6L12 3Z" />
    <path d="m8.8 12 2.2 2.2 4.2-4.4" />
  </svg>
);

export const LockIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
    <path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" />
  </svg>
);

export const SparkIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.2 6.2l2.6 2.6M15.2 15.2l2.6 2.6M6.2 17.8l2.6-2.6M15.2 8.8l2.6-2.6" />
  </svg>
);

export const PlaneIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M10.5 13.5 3 11l1.5-1.5 8 .5 4.8-4.8a2 2 0 0 1 2.9 2.9L15.4 13l.5 8-1.5 1.5-2.5-7.5" />
  </svg>
);

export const PinIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
    <circle cx="12" cy="10" r="2.3" />
  </svg>
);

export const CheckIcon = (props: IconProps) => (
  <svg {...base(props)} strokeWidth={2.6}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);

export const VerifiedIcon = (props: IconProps) => (
  <svg {...base(props)} stroke="none">
    <path
      fill="currentColor"
      d="M12 1.8 14.6 4l3.4-.3.9 3.3 3 1.7-1.3 3.2 1.3 3.2-3 1.7-.9 3.3-3.4-.3L12 22.2 9.4 20l-3.4.3-.9-3.3-3-1.7 1.3-3.2-1.3-3.2 3-1.7.9-3.3 3.4.3L12 1.8Z"
    />
    <path
      d="m8.3 12.2 2.5 2.5 4.9-5"
      stroke="#fff"
      strokeWidth={2.2}
      fill="none"
    />
  </svg>
);

export const PlayIcon = (props: IconProps) => (
  <svg {...base(props)} fill="currentColor" stroke="none">
    <path d="M8 5.5v13a1 1 0 0 0 1.5.9l10.4-6.5a1 1 0 0 0 0-1.8L9.5 4.6A1 1 0 0 0 8 5.5Z" />
  </svg>
);

export const AppleIcon = (props: IconProps) => (
  <svg {...base(props)} fill="currentColor" stroke="none">
    <path d="M16.4 12.7c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.8 1.2 1.8 2.6 3.1 2.6 1.3-.1 1.7-.8 3.3-.8 1.5 0 1.9.8 3.3.8 1.4 0 2.2-1.2 3-2.5.9-1.4 1.3-2.8 1.3-2.8s-2.6-1-2.6-4.2ZM13.9 5.1c.7-.9 1.2-2 1-3.2-1 0-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.2.1 2.3-.6 3.1-1.5Z" />
  </svg>
);

export const PlayStoreIcon = (props: IconProps) => (
  <svg {...base(props)} stroke="none">
    <path
      fill="#00d7fe"
      d="M3.6 2.3 13.4 12l-9.8 9.7c-.4-.2-.6-.6-.6-1.1V3.4c0-.5.2-.9.6-1.1Z"
    />
    <path
      fill="#ffd400"
      d="m16.7 15.3-3.3-3.3 3.3-3.3 3.8 2.2c1 .6 1 1.6 0 2.2l-3.8 2.2Z"
    />
    <path
      fill="#ff3a44"
      d="M16.7 15.3 13.4 12l-9.8 9.7c.4.2.9.2 1.4-.1l11.7-6.3Z"
    />
    <path
      fill="#00f076"
      d="M16.7 8.7 5 2.4c-.5-.3-1-.3-1.4-.1l9.8 9.7 3.3-3.3Z"
    />
  </svg>
);

export const SunIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
  </svg>
);

export const MoonIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
  </svg>
);
