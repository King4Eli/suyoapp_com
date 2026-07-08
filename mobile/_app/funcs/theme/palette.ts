// Static light/dark color map. Every screen should pull colors from here (via
// useTheme()) instead of hardcoding hex values, so the app can actually re-skin
// itself when the user switches appearance mode.
//
// Palette direction: warm, editorial, "Hinge / Feeld" energy. A single warm
// porcelain ground, warm near-black ink, one confident rose accent, a muted
// aubergine as the secondary interactive tint, and a real gold for premium.
export type ThemeColors = {
  background: string;
  backgroundSecondary: string;
  surface: string;
  surfaceElevated: string;
  card: string;
  border: string;
  borderLight: string;
  divider: string;
  /** Hairline separators -- thinner/softer than `border`. */
  hairline: string;

  text: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;
  placeholder: string;

  primary: string;
  primaryDark: string;
  /** Low-emphasis primary fill for chips, badges, selected states. */
  primarySoft: string;
  onPrimary: string;
  accent: string;
  /** Low-emphasis accent fill (mirrors `primarySoft`). */
  accentSoft: string;

  /** Brand gradient stops -- use for CTAs, hero overlays, superlike bursts. */
  gradientStart: string;
  gradientEnd: string;

  success: string;
  danger: string;
  /** Alias of `danger` -- some screens historically named this key `error`. */
  error: string;
  warning: string;
  info: string;
  premium: string;
  /** Low-emphasis premium fill. */
  premiumSoft: string;

  overlay: string;
  /** Translucent surface for blurred/glass panels (nav bars, action docks). */
  glass: string;
  /** Hairline border that sits on top of a glass panel. */
  glassBorder: string;
  shadow: string;
  disabled: string;
  skeleton: string;
  inputBackground: string;

  statusBarStyle: 'light-content' | 'dark-content';
};

export const lightColors: ThemeColors = {
  // Warm porcelain ground sits a shade below surface/card so elevated elements
  // (message bubbles, nav bars, rows) read as distinct layers instead of
  // blending into the screen behind them.
  background: '#FAF7F4',
  backgroundSecondary: '#F1EBE5',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  card: '#FFFFFF',
  border: '#E7DFD8',
  borderLight: '#EFE8E2',
  divider: '#ECE4DD',
  hairline: '#EAE1DA',

  text: '#221E1B',
  textSecondary: '#6C625B',
  textTertiary: '#9C9089',
  textInverse: '#FFFFFF',
  placeholder: '#A79C94',

  primary: '#E24862',
  primaryDark: '#B23350',
  primarySoft: '#FBE7EC',
  onPrimary: '#FFFFFF',
  accent: '#6E4B8E',
  accentSoft: '#EFE7F4',

  gradientStart: '#F0577A',
  gradientEnd: '#B23FA0',

  success: '#2E9E5B',
  danger: '#E14848',
  error: '#E14848',
  warning: '#DE8A34',
  info: '#3B87CF',
  premium: '#BE8C36',
  premiumSoft: '#F6ECD8',

  overlay: 'rgba(26,20,17,0.55)',
  glass: 'rgba(255,255,255,0.72)',
  glassBorder: 'rgba(255,255,255,0.6)',
  shadow: '#2A211C',
  disabled: '#D9CFC7',
  skeleton: '#ECE3DC',
  inputBackground: '#F1EAE4',

  statusBarStyle: 'dark-content',
};

export const darkColors: ThemeColors = {
  // Warm charcoal rather than blue-black, so the rose/gold accents stay warm.
  background: '#131110',
  backgroundSecondary: '#1B1816',
  surface: '#211D1B',
  // Elevated further above `surface` so bubbles/modals/nav bars stay visibly
  // separated from the near-black background.
  surfaceElevated: '#2C2724',
  card: '#211D1B',
  border: '#3A3430',
  borderLight: '#332E2A',
  divider: '#332E2A',
  hairline: '#302B27',

  text: '#F4EFEB',
  textSecondary: '#B6ABA3',
  textTertiary: '#897F77',
  textInverse: '#1B1816',
  placeholder: '#7C7169',

  primary: '#FF5C79',
  primaryDark: '#D6455E',
  primarySoft: 'rgba(255,92,121,0.16)',
  onPrimary: '#FFFFFF',
  accent: '#B79AE0',
  accentSoft: 'rgba(183,154,224,0.16)',

  gradientStart: '#FF5C79',
  gradientEnd: '#C558B8',

  success: '#3DCE7C',
  danger: '#FF5F5F',
  error: '#FF5F5F',
  warning: '#EDA25A',
  info: '#5BA6E8',
  premium: '#E4BE6B',
  premiumSoft: 'rgba(228,190,107,0.16)',

  overlay: 'rgba(0,0,0,0.66)',
  glass: 'rgba(28,24,22,0.66)',
  glassBorder: 'rgba(255,255,255,0.08)',
  shadow: '#000000',
  disabled: '#4A423D',
  skeleton: '#2A2320',
  inputBackground: '#262120',

  statusBarStyle: 'light-content',
};

export const palettes = { light: lightColors, dark: darkColors };
