import React from 'react';
import { StyleSheet, View } from 'react-native';
import NativeLinearGradient, {
  LinearGradientProps,
} from 'react-native-linear-gradient';

const RADIUS_KEYS = [
  'borderRadius',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomLeftRadius',
  'borderBottomRightRadius',
] as const;

/**
 * Drop-in for react-native-linear-gradient. v2.8 has no new-architecture
 * component, so it renders through the legacy interop layer, which on iOS
 * shifts the native view by its own padding and clips its children (cards
 * drawn off-centre with their bottom cut off). Here the native gradient is only
 * ever a style-less absolute-fill background; the caller's style (padding,
 * size, radius, shadow) goes on a plain View.
 */
export const LinearGradient = ({
  colors,
  start,
  end,
  locations,
  useAngle,
  angle,
  angleCenter,
  style,
  children,
  ...rest
}: LinearGradientProps) => {
  const flat = StyleSheet.flatten(style) ?? {};
  const radii: Record<string, unknown> = {};
  for (const key of RADIUS_KEYS) {
    if (flat[key] !== undefined) radii[key] = flat[key];
  }

  return (
    <View {...rest} style={style}>
      {/* Rounded and clipped separately so the outer view keeps its shadow */}
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, radii, { overflow: 'hidden' }]}
      >
        <NativeLinearGradient
          colors={colors}
          start={start}
          end={end}
          locations={locations}
          useAngle={useAngle}
          angle={angle}
          angleCenter={angleCenter}
          style={StyleSheet.absoluteFill}
        />
      </View>
      {children}
    </View>
  );
};

export default LinearGradient;
