import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import IIcon from 'react-native-vector-icons/Ionicons';
import { useTheme, ThemeColors } from './theme';

// App-styled replacement for the system Alert.alert: same call shape
// (title, message, buttons, options) so call sites read the same, but themed,
// with a tone icon, and queued so two dialogs never fight for the screen.
// Mounted once in App.tsx, next to <Toastx />.

export type DialogButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

export type DialogTone = 'success' | 'error' | 'warning' | 'info' | 'danger';

export type DialogOptions = {
  tone?: DialogTone;
  /** Ionicons name, overrides the tone's icon */
  icon?: string;
  /** Tapping outside / Android back closes it (runs the cancel button). Default true. */
  cancelable?: boolean;
  onDismiss?: () => void;
};

type DialogItem = {
  id: number;
  title: string;
  message?: string;
  buttons: DialogButton[];
  options: DialogOptions;
};

let pushDialog: ((item: DialogItem) => void) | null = null;
let idSeed = 0;

const TONE_ICON: Record<DialogTone, string> = {
  success: 'checkmark-circle',
  error: 'close-circle',
  warning: 'alert-circle',
  info: 'information-circle',
  danger: 'warning',
};

const toneColor = (tone: DialogTone, colors: ThemeColors) =>
  ({
    success: colors.success,
    error: colors.danger,
    warning: colors.warning,
    info: colors.primary,
    danger: colors.danger,
  }[tone]);

export const Dialogx = () => {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const [queue, setQueue] = useState<DialogItem[]>([]);
  const current = queue[0] ?? null;
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    pushDialog = item => setQueue(prev => [...prev, item]);
    return () => {
      pushDialog = null;
    };
  }, []);

  useEffect(() => {
    if (!current) return;
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [current, anim]);

  const close = (button?: DialogButton) => {
    const item = current;
    setQueue(prev => prev.slice(1));
    // Run after the dialog is gone so a handler that opens another dialog or
    // navigates doesn't collide with this one closing.
    setTimeout(() => {
      if (button) button.onPress?.();
      else {
        item?.buttons.find(b => b.style === 'cancel')?.onPress?.();
        item?.options.onDismiss?.();
      }
    }, 0);
  };

  if (!current) return null;

  const { title, message, buttons, options } = current;
  const tone: DialogTone =
    options.tone ??
    (buttons.some(b => b.style === 'destructive') ? 'danger' : 'info');
  const accent = toneColor(tone, colors);
  const cancelable = options.cancelable !== false;
  const cancels = buttons.filter(b => b.style === 'cancel');
  const actions = buttons.filter(b => b.style !== 'cancel');
  const inRow = buttons.length === 2;
  // Two buttons: cancel left, action right. More: stacked, main action on top,
  // cancel at the bottom.
  const ordered = inRow ? [...cancels, ...actions] : [...actions, ...cancels];
  const primaryButton = inRow ? actions[actions.length - 1] : actions[0];

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => cancelable && close()}
    >
      <Animated.View style={[s.backdrop, { opacity: anim }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => cancelable && close()}
        />
        <Animated.View
          style={[
            s.card,
            {
              opacity: anim,
              transform: [
                {
                  scale: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.92, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={[s.iconWrap, { backgroundColor: accent + '1F' }]}>
            <IIcon
              name={options.icon ?? TONE_ICON[tone]}
              size={30}
              color={accent}
            />
          </View>
          <Text style={s.title}>{title}</Text>
          {!!message && <Text style={s.message}>{message}</Text>}

          <View style={[s.buttons, inRow && s.buttonsRow]}>
            {ordered.map((button, idx) => {
              const isCancel = button.style === 'cancel';
              const isDestructive = button.style === 'destructive';
              const isPrimary = !isCancel && button === primaryButton;
              const fill = isDestructive
                ? colors.danger
                : isPrimary
                ? tone === 'success'
                  ? colors.success
                  : colors.primary
                : 'transparent';
              return (
                <Pressable
                  key={`${button.text}-${idx}`}
                  onPress={() => close(button)}
                  style={({ pressed }) => [
                    s.button,
                    inRow && { flex: 1 },
                    { backgroundColor: fill },
                    !isPrimary &&
                      !isDestructive && {
                        borderWidth: 1,
                        borderColor: colors.border,
                      },
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Text
                    style={[
                      s.buttonText,
                      {
                        color:
                          isPrimary || isDestructive
                            ? colors.onPrimary
                            : colors.text,
                      },
                    ]}
                  >
                    {button.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

/** Drop-in for Alert.alert(title, message, buttons), plus `options.tone`. */
Dialogx.alert = (
  title: string,
  message?: string,
  buttons?: DialogButton[],
  options?: DialogOptions,
) => {
  const item: DialogItem = {
    id: ++idSeed,
    title,
    message,
    buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }],
    options: options ?? {},
  };
  if (pushDialog) pushDialog(item);
  else console.warn('Dialog is not mounted yet.');
};

/** Yes/no question; resolves true only when the confirm button is tapped. */
Dialogx.confirm = ({
  title,
  message,
  confirmText = 'OK',
  cancelText = 'Cancel',
  destructive = false,
  tone,
  icon,
}: {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  tone?: DialogTone;
  icon?: string;
}) =>
  new Promise<boolean>(resolve => {
    Dialogx.alert(
      title,
      message,
      [
        { text: cancelText, style: 'cancel', onPress: () => resolve(false) },
        {
          text: confirmText,
          style: destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
      { tone, icon, onDismiss: () => resolve(false) },
    );
  });

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    card: {
      width: '100%',
      maxWidth: 380,
      borderRadius: 26,
      backgroundColor: colors.surfaceElevated,
      paddingHorizontal: 22,
      paddingTop: 24,
      paddingBottom: 18,
      alignItems: 'center',
    },
    iconWrap: {
      width: 58,
      height: 58,
      borderRadius: 29,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    title: {
      fontSize: 19,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'center',
      letterSpacing: -0.2,
    },
    message: {
      fontSize: 14.5,
      lineHeight: 21,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 8,
    },
    buttons: { alignSelf: 'stretch', gap: 10, marginTop: 22 },
    buttonsRow: { flexDirection: 'row' },
    button: {
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
    },
    buttonText: { fontSize: 15, fontWeight: '700' },
  });
}
