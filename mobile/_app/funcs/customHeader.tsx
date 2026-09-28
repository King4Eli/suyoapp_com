import React from 'react';
import { Pressable, StyleProp, View, ViewStyle } from 'react-native';
import IIcon from 'react-native-vector-icons/Ionicons';
import MIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme, radius, elevation } from './theme';

/** One icon size and tap target for every header button in the app. */
export const HEADER_ICON_SIZE = 22;
export const HEADER_BUTTON_SIZE = 36;
/** Side inset for headers we draw ourselves (the bottom-tab headers). */
export const HEADER_SIDE_INSET = 16;

type HeaderIconButtonProps = {
  /** Ionicons name, or a MaterialCommunityIcons name with family="mci" */
  name: string;
  family?: 'ion' | 'mci';
  color?: string;
  onPress: () => void;
};

export const HeaderIconButton = ({
  name,
  family = 'ion',
  color,
  onPress,
}: HeaderIconButtonProps) => {
  const { colors } = useTheme();
  const Icon = family === 'mci' ? MIcon : IIcon;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        {
          width: HEADER_BUTTON_SIZE,
          height: HEADER_BUTTON_SIZE,
          borderRadius: HEADER_BUTTON_SIZE / 2,
          alignItems: 'center',
          justifyContent: 'center',
        },
        pressed && { backgroundColor: colors.backgroundSecondary },
      ]}
    >
      <Icon name={name} size={HEADER_ICON_SIZE} color={color ?? colors.text} />
    </Pressable>
  );
};

/** Pill that groups header icon buttons (tab screens). */
export const HeaderActions = ({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) => {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 2,
          padding: 2,
          borderRadius: radius.pill,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.hairline,
        },
        elevation(colors.shadow, 1),
        style,
      ]}
    >
      {children}
    </View>
  );
};
