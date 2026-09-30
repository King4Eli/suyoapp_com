import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import IIcon from 'react-native-vector-icons/Ionicons';
import { styles, __CONFIG__ } from '../funcs/static';
import { _http_request, cacheStorage, logReport } from '../funcs/functions';
import { Toastx } from '../funcs/customNotification';
import { useTheme, ThemeColors } from '../funcs/theme';

export type NotificationChannel = 'push' | 'email';

const CATEGORIES = [
  {
    key: 'likes',
    icon: 'heart-outline',
    title: 'New likes',
    subtitle: 'When someone likes or superlikes you',
    default: true,
  },
  {
    key: 'matches',
    icon: 'sparkles-outline',
    title: 'New matches',
    subtitle: 'When a like turns into a match',
    default: true,
  },
  {
    key: 'messages',
    icon: 'chatbubble-ellipses-outline',
    title: 'New messages',
    subtitle: 'When a match sends you a message',
    default: true,
  },
  {
    key: 'promotions',
    icon: 'pricetag-outline',
    title: 'Promotions',
    subtitle: 'Offers and discounts on Plus, VIP and boosts',
    default: false,
  },
  {
    key: 'announcements',
    icon: 'megaphone-outline',
    title: 'Announcements',
    subtitle: 'New features and news about the app',
    default: true,
  },
] as const;

const CHANNEL_COPY: Record<
  NotificationChannel,
  { title: string; intro: string; master: string; icon: string; always: string }
> = {
  push: {
    title: 'Push notifications',
    intro: 'Alerts on your phone. Pick what they cover.',
    master: 'Allow push notifications',
    icon: 'phone-portrait-outline',
    always:
      'Sign-in codes, security alerts, receipts and billing updates still reach you by email.',
  },
  email: {
    title: 'Email notifications',
    intro: 'Sent while you are away from the app. Pick what they cover.',
    master: 'Allow email notifications',
    icon: 'mail-outline',
    always:
      'Important emails are always sent: sign-in codes, security alerts, receipts and billing updates.',
  },
};

/**
 * profile.notifications from getProfile is flat: { push, email, push_likes,
 * email_likes, ... } (users.user_notify_*). Missing keys fall back to defaults.
 */
const readPrefs = (channel: NotificationChannel, n: any) => {
  const prefs: Record<string, boolean> = { [channel]: n?.[channel] ?? true };
  for (const c of CATEGORIES) {
    prefs[`${channel}_${c.key}`] = n?.[`${channel}_${c.key}`] ?? c.default;
  }
  return prefs;
};

export function Screen_notificationSettings({
  navigation,
  route,
}: {
  navigation: any;
  route: any;
}) {
  const channel: NotificationChannel =
    route?.params?.channel === 'email' ? 'email' : 'push';
  const copy = CHANNEL_COPY[channel];
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const [prefs, setPrefs] = useState(() => readPrefs(channel, null));
  const [hasRealEmail, setHasRealEmail] = useState(true);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerStyle: { backgroundColor: colors.background },
      headerShadowVisible: false,
      headerTitle: '',
    });
  }, [navigation, colors.background]);

  useEffect(() => {
    let mounted = true;
    cacheStorage
      .getCurrentUserProfile()
      .then((profile: any) => {
        if (!mounted || !profile) return;
        setPrefs(readPrefs(channel, profile?.profile?.notifications));
        setHasRealEmail(!!(profile?.profile?.email ?? profile?.user_email));
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [channel]);

  // Saves one toggle as soon as it's flipped; puts it back if the save fails.
  const toggle = async (key: string) => {
    const value = !prefs[key];
    setPrefs(p => ({ ...p, [key]: value }));
    try {
      const response = await _http_request({
        customApiUrl: __CONFIG__.HTTPS_API_DOMAIN + '/api/core/v1/pushProfile',
        reqType: 'POST',
        bodyArray: { prof_notifications: { [key]: value } },
      });
      if (response?.code !== 200) {
        throw new Error(response?.message ?? 'Failed to save');
      }
      cacheStorage.getCurrentUserProfile(true);
    } catch {
      setPrefs(p => ({ ...p, [key]: !value }));
      Toastx.show({
        type: 'error',
        message: "Couldn't save that change. Please try again.",
      });
      logReport({
        type: 'function',
        useraction: 'notificationSettings.toggle',
        logMessage: `Failed to save notification setting ${key}`,
      });
    }
  };

  const Switch = ({
    value,
    disabled,
    onPress,
    label,
  }: {
    value: boolean;
    disabled?: boolean;
    onPress: () => void;
    label: string;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      hitSlop={8}
    >
      <View style={[s.switchTrack, value && s.switchTrackActive]}>
        <View style={[s.switchThumb, value && s.switchThumbActive]} />
      </View>
    </TouchableOpacity>
  );

  const Row = ({
    icon,
    title,
    subtitle,
    value,
    onPress,
    disabled,
    hr = true,
  }: {
    icon: string;
    title: string;
    subtitle?: string;
    value: boolean;
    onPress: () => void;
    disabled?: boolean;
    hr?: boolean;
  }) => (
    <View style={[s.row, hr && s.rowDivider, disabled && s.rowDisabled]}>
      <View style={s.rowIcon}>
        <IIcon name={icon} size={20} color={colors.primary} />
      </View>
      <View style={s.rowContent}>
        <Text style={s.rowTitle}>{title}</Text>
        {!!subtitle && <Text style={s.rowSubtitle}>{subtitle}</Text>}
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onPress={onPress}
        label={title}
      />
    </View>
  );

  const enabled = prefs[channel];

  return (
    <SafeAreaView
      style={{ backgroundColor: colors.background, flex: 1 }}
      edges={['bottom']}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.conainerScrollView}
      >
        <Text style={s.pageTitle}>{copy.title}</Text>
        <Text style={s.pageSubtitle}>{copy.intro}</Text>

        {channel === 'email' && !hasRealEmail && (
          <View style={[s.note, { marginTop: 0, marginBottom: 16 }]}>
            <IIcon name="information-circle" size={18} color={colors.info} />
            <Text style={s.noteText}>
              Add an email address under Settings &gt; Account to get these.
            </Text>
          </View>
        )}

        <View style={s.card}>
          <Row
            icon={copy.icon}
            title={copy.master}
            subtitle={enabled ? 'On' : 'Off · only important ones get through'}
            value={enabled}
            onPress={() => toggle(channel)}
            hr={false}
          />
        </View>

        <Text style={s.sectionTitle}>Notify me about</Text>
        <View style={s.card}>
          {CATEGORIES.map((c, i) => (
            <Row
              key={c.key}
              icon={c.icon}
              title={c.title}
              subtitle={c.subtitle}
              value={prefs[`${channel}_${c.key}`]}
              onPress={() => toggle(`${channel}_${c.key}`)}
              disabled={!enabled}
              hr={i < CATEGORIES.length - 1}
            />
          ))}
        </View>
        {!enabled && (
          <View style={s.note}>
            <IIcon name="information-circle" size={18} color={colors.info} />
            <Text style={s.noteText}>
              Your choices are kept for when you turn{' '}
              {channel === 'push' ? 'push' : 'email'} back on.
            </Text>
          </View>
        )}

        <View style={s.footer}>
          <IIcon
            name="shield-checkmark-outline"
            size={16}
            color={colors.textSecondary}
          />
          <Text style={s.footerText}>{copy.always}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    pageTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.text,
    },
    pageSubtitle: {
      fontSize: 15,
      color: colors.textSecondary,
      marginTop: 4,
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      marginTop: 28,
      marginBottom: 12,
      paddingHorizontal: 4,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      paddingHorizontal: 16,
      ...Platform.select({
        ios: {
          shadowColor: colors.text,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.05,
          shadowRadius: 12,
        },
        android: { elevation: 3 },
      }),
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
    },
    rowDivider: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    rowDisabled: {
      opacity: 0.45,
    },
    rowIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    rowContent: {
      flex: 1,
      marginRight: 12,
    },
    rowTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    rowSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    switchTrack: {
      width: 52,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.border,
      padding: 2,
      justifyContent: 'center',
    },
    switchTrackActive: {
      backgroundColor: colors.primary,
    },
    switchThumb: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.surface,
    },
    switchThumbActive: {
      transform: [{ translateX: 20 }],
    },
    note: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      marginTop: 12,
      paddingHorizontal: 4,
    },
    noteText: {
      flex: 1,
      fontSize: 13,
      color: colors.textSecondary,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      marginTop: 20,
      marginBottom: 24,
      paddingHorizontal: 4,
    },
    footerText: {
      flex: 1,
      fontSize: 13,
      color: colors.textSecondary,
    },
  });
}

export default Screen_notificationSettings;
