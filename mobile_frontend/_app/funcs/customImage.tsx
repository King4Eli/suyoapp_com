import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import FastImage, { FastImageProps } from 'react-native-fast-image';
import IIcon from 'react-native-vector-icons/Ionicons';
import { useTheme } from './theme';

type SafeImageProps = Omit<FastImageProps, 'source'> & {
  source: { uri?: string | null; [key: string]: any } | number;
  containerStyle?: any;
  fallbackIconSize?: number;
};

/**
 * FastImage's `onError` only ever fires telemetry across the app today -- nothing
 * visually changes when a photo 404s/times out, so the user is left staring at a
 * permanently blank tile. This wraps FastImage with a graceful fallback (a person
 * icon over a themed placeholder), shown both when loading fails and when there's
 * no uri to load in the first place.
 */
export const SafeImage = ({
  source,
  style,
  containerStyle,
  onError,
  fallbackIconSize,
  resizeMode,
  ...rest
}: SafeImageProps) => {
  const { colors } = useTheme();
  const [hasError, setHasError] = useState(false);
  const uri = typeof source === 'object' ? source?.uri : undefined;

  // A carousel/list can reuse this component for a new photo -- don't keep
  // showing the old fallback once the uri actually changes.
  useEffect(() => {
    setHasError(false);
  }, [uri]);

  if (hasError || !uri) {
    return (
      <View
        style={[
          style,
          containerStyle,
          {
            backgroundColor: colors.backgroundSecondary,
            alignItems: 'center',
            justifyContent: 'center',
          },
        ]}
      >
        <IIcon
          name="person"
          size={fallbackIconSize ?? 28}
          color={colors.textTertiary}
        />
      </View>
    );
  }

  return (
    <FastImage
      source={source}
      style={style}
      resizeMode={resizeMode ?? FastImage.resizeMode.cover}
      onError={e => {
        setHasError(true);
        onError?.(e);
      }}
      {...rest}
    />
  );
};
