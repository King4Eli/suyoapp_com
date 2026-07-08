// Non-color design tokens shared across screens so spacing, corner radii,
// type scale and motion feel like one product instead of 17 separate screens.
// Import via `import { spacing, radius, type, motion, elevation } from '../funcs/theme'`.
import { Easing, Platform } from 'react-native';

/** 4pt spacing scale. Use `spacing.md` etc. instead of raw magic numbers. */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

/** Corner radii. `pill` is intentionally huge so it always fully rounds. */
export const radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 26,
  xxl: 32,
  pill: 999,
} as const;

/**
 * Type ramp. Weights are strings for RN. Pair `size` with `lineHeight` and,
 * for display styles, the slightly tightened `letterSpacing`.
 */
export const type = {
  display: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800' as const,
    letterSpacing: -0.3,
  },
  headline: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
  },
  subtitle: { fontSize: 17, lineHeight: 23, fontWeight: '700' as const },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' as const },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: '600' as const },
  callout: { fontSize: 14, lineHeight: 19, fontWeight: '500' as const },
  caption: { fontSize: 12.5, lineHeight: 16, fontWeight: '500' as const },
  overline: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700' as const,
    letterSpacing: 1.1,
    textTransform: 'uppercase' as const,
  },
} as const;

/** Animation timings + easings. Keep motion quick and confident. */
export const motion = {
  fast: 140,
  base: 220,
  slow: 320,
  /** Standard ease for enter/exit fades and slides. */
  easeOut: Easing.bezier(0.22, 1, 0.36, 1),
  easeInOut: Easing.bezier(0.65, 0, 0.35, 1),
  /** Reanimated spring config for card / sheet / button press. */
  spring: { damping: 18, stiffness: 220, mass: 0.9 },
  springSoft: { damping: 20, stiffness: 140, mass: 1 },
} as const;

/**
 * Cross-platform elevation presets. Spread onto a style:
 *   style={[styles.card, elevation(colors.shadow, 2)]}
 */
export const elevation = (
  shadowColor: string,
  level: 0 | 1 | 2 | 3 | 4 = 1,
) => {
  if (level === 0) {
    return Platform.OS === 'android'
      ? { elevation: 0 }
      : {
          shadowColor,
          shadowOpacity: 0,
          shadowRadius: 0,
          shadowOffset: { width: 0, height: 0 },
        };
  }
  const map = {
    1: { e: 2, o: 0.08, r: 6, y: 2 },
    2: { e: 5, o: 0.12, r: 12, y: 5 },
    3: { e: 10, o: 0.16, r: 20, y: 9 },
    4: { e: 18, o: 0.22, r: 30, y: 14 },
  } as const;
  const s = map[level];
  return Platform.OS === 'android'
    ? { elevation: s.e, shadowColor }
    : {
        shadowColor,
        shadowOpacity: s.o,
        shadowRadius: s.r,
        shadowOffset: { width: 0, height: s.y },
      };
};

/** Standard screen gutter. */
export const GUTTER = spacing.lg;
/** Standard touch target minimum. */
export const HIT = 44;
