import { useState } from 'react';
import { useHeaderHeight } from '@react-navigation/elements';

/**
 * @react-navigation/native-stack reports the correct header height on first
 * render, then drops it to 0 on a later re-render (open upstream bug:
 * https://github.com/react-navigation/react-navigation/issues/12545).
 * We don't use dynamic-height headers (no large titles/search bars), so it's
 * safe to lock onto the first non-zero value and ignore later resets.
 */
export function useStableHeaderHeight() {
  const headerHeight = useHeaderHeight();
  const [stableHeight, setStableHeight] = useState(0);

  if (headerHeight > 0 && headerHeight !== stableHeight) {
    setStableHeight(headerHeight);
  }

  return stableHeight || headerHeight;
}
