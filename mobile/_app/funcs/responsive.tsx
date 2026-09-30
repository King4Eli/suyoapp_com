import React from 'react';
import { View, useWindowDimensions } from 'react-native';

/**
 * Screen content never gets wider than this. On tablets and in landscape the
 * column is centred instead of stretching cards, rows and text edge to edge.
 */
export const MAX_CONTENT_WIDTH = 720;
/** Shortest side at which the device counts as a tablet. */
export const TABLET_MIN_WIDTH = 600;

/**
 * Width available to a screen's content. Live: follows rotation, split screen
 * and window resizes, unlike a Dimensions.get() read once at startup.
 */
export function useContentWidth() {
  const { width } = useWindowDimensions();
  return Math.min(width, MAX_CONTENT_WIDTH);
}

export function useResponsive() {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const contentWidth = Math.min(windowWidth, MAX_CONTENT_WIDTH);
  return {
    windowWidth,
    windowHeight,
    contentWidth,
    isTablet: Math.min(windowWidth, windowHeight) >= TABLET_MIN_WIDTH,
    /** Small phones (e.g. iPhone SE, compact Androids) */
    isCompact: contentWidth < 360,
  };
}

/**
 * Wraps every screen (navigator `screenLayout`) in a centred column capped at
 * MAX_CONTENT_WIDTH. Headers stay full width; only the content is constrained.
 */
export function ResponsiveScreen({ children }: { children: React.ReactNode }) {
  const contentWidth = useContentWidth();
  return (
    <View style={{ flex: 1, width: contentWidth, alignSelf: 'center' }}>
      {children}
    </View>
  );
}
