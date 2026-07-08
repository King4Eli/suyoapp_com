// Local type stub for rn-range-slider.
// The published package ships untyped .tsx source (`main: index.tsx`, no `types`
// field) which fails `tsc --noEmit` under this project's strict config. This
// declaration shadows it via `compilerOptions.paths` in tsconfig.json.
declare module 'rn-range-slider' {
  import * as React from 'react';
  import { StyleProp, ViewStyle } from 'react-native';

  export interface RangeSliderProps {
    min: number;
    max: number;
    step: number;
    low?: number;
    high?: number;
    minRange?: number;
    disableRange?: boolean;
    floatingLabel?: boolean;
    allowLabelOverflow?: boolean;
    disabled?: boolean;
    style?: StyleProp<ViewStyle>;
    renderThumb: (name: 'high' | 'low') => React.ReactNode;
    renderRail: () => React.ReactNode;
    renderRailSelected: () => React.ReactNode;
    renderLabel?: (value: number) => React.ReactNode;
    renderNotch?: () => React.ReactNode;
    onValueChanged?: (low: number, high: number, byUser: boolean) => void;
    onSliderTouchStart?: (low: number, high: number) => void;
    onSliderTouchEnd?: (low: number, high: number) => void;
  }

  const RangeSlider: React.ComponentType<RangeSliderProps>;
  export default RangeSlider;
}
