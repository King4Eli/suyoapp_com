// Static light/dark color map. Every screen should pull colors from here (via
// useTheme()) instead of hardcoding hex values, so the app can actually re-skin
// itself when the user switches appearance mode.
export type ThemeColors = {
  background: string;
  backgroundSecondary: string;
  surface: string;
  surfaceElevated: string;
  card: string;
  border: string;
  borderLight: string;
  divider: string;

  text: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;
  placeholder: string;

  primary: string;
  primaryDark: string;
  onPrimary: string;
  accent: string;

  success: string;
  danger: string;
  /** Alias of `danger` -- some screens historically named this key `error`. */
  error: string;
  warning: string;
  info: string;
  premium: string;

  overlay: string;
  shadow: string;
  disabled: string;
  skeleton: string;
  inputBackground: string;

  statusBarStyle: 'light-content' | 'dark-content';
};

export const lightColors: ThemeColors = {
  // background sits a shade below surface/card/surfaceElevated so elevated
  // elements (message bubbles, nav bars, rows) read as distinct layers instead
  // of blending into the screen behind them.
  background: '#F2F3F8',
  backgroundSecondary: '#E8E9F1',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  card: '#FFFFFF',
  border: '#DBDDE8',
  borderLight: '#E3E4EC',
  divider: '#E5E6EE',

  text: '#1F1F1F',
  textSecondary: '#666666',
  textTertiary: '#999999',
  textInverse: '#FFFFFF',
  placeholder: '#999999',

  primary: '#FF3B6B',
  primaryDark: '#C935AE',
  onPrimary: '#FFFFFF',
  accent: '#4F8EF7',

  success: '#34C759',
  danger: '#FF3B30',
  error: '#FF3B30',
  warning: '#FF9900',
  info: '#1FAAFF',
  premium: '#FFD166',

  overlay: 'rgba(0,0,0,0.5)',
  shadow: '#000000',
  disabled: '#C4C4C4',
  skeleton: '#E4E5EC',
  inputBackground: '#ECEDF4',

  statusBarStyle: 'dark-content',
};

export const darkColors: ThemeColors = {
  background: '#0B0B0F',
  backgroundSecondary: '#151518',
  surface: '#1E1E24',
  // Elevated further above `surface` than before so bubbles/modals/nav bars
  // stay visibly separated from the near-black background (the old value was
  // too close in luminance and effectively blended in).
  surfaceElevated: '#2A2A31',
  card: '#1E1E24',
  border: '#3A3A42',
  borderLight: '#33333B',
  divider: '#33333B',

  text: '#F2F2F3',
  textSecondary: '#B5B5BD',
  textTertiary: '#8A8A92',
  textInverse: '#1F1F1F',
  placeholder: '#7A7A82',

  primary: '#FF5478',
  primaryDark: '#D946B8',
  onPrimary: '#FFFFFF',
  accent: '#6FA3FF',

  success: '#32D74B',
  danger: '#FF453A',
  error: '#FF453A',
  warning: '#FFB340',
  info: '#409CFF',
  premium: '#FFD166',

  overlay: 'rgba(0,0,0,0.65)',
  shadow: '#000000',
  disabled: '#4A4A52',
  skeleton: '#2A2A30',
  inputBackground: '#26262D',

  statusBarStyle: 'light-content',
};

export const palettes = { light: lightColors, dark: darkColors };
