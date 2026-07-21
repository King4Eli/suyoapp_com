import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  LinearTransition,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import IIcon from 'react-native-vector-icons/Ionicons';
import { screenWidth } from "./functions";
import { useTheme } from "./theme";
import type { ThemeColors } from "./theme/palette";

type ToastType = 'success' | 'error' | 'info' | 'warning';

type ToastOptions = {
  title?: string;
  message: string;
  type?: ToastType;
  duration?: number;
  icon?: string;
  position?: 'top' | 'bottom';
  onPress?: () => void; // Just one optional tap handler
};

type ToastItem = ToastOptions & { id: number };

let pushToast: (opts: ToastOptions) => void;
let idSeed = 0;

// Cap how many banners can stack at once -- protects against a runaway
// retry loop (e.g. repeated network errors) flooding the screen.
const MAX_STACK = 3;

const SEMANTIC_ICONS: Record<ToastType, string> = {
  success: 'checkmark-circle',
  error: 'alert-circle',
  warning: 'warning',
  info: 'information-circle',
};

const getAccentColor = (colors: ThemeColors, type?: ToastType) => {
  switch (type) {
    case 'success': return colors.success;
    case 'error': return colors.danger;
    case 'warning': return colors.warning;
    case 'info': return colors.info;
    default: return colors.primary;
  }
};

// Appends an alpha channel to a 6-digit hex color, e.g. withAlpha('#FF3B6B', '22').
const withAlpha = (hex: string, alpha: string) => (hex.length === 7 ? `${hex}${alpha}` : hex);

const ToastCard = ({
  item,
  colors,
  isBottom,
  onDismiss,
}: {
  item: ToastItem;
  colors: ThemeColors;
  isBottom: boolean;
  onDismiss: () => void;
}) => {
  const duration = item.duration && item.duration > 0 ? item.duration : 5000;
  const accent = getAccentColor(colors, item.type);
  const iconName = item.icon ?? (item.type ? SEMANTIC_ICONS[item.type] : 'notifications');

  const translateX = useSharedValue(0);
  const enter = useSharedValue(0);
  const progress = useSharedValue(1);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remainingRef = useRef(duration);
  const lastResumeAtRef = useRef(Date.now());
  const dismissedRef = useRef(false);

  const runDismiss = () => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    cancelAnimation(progress);
    enter.value = withTiming(0, { duration: 180, easing: Easing.in(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(onDismiss)();
    });
  };

  // Pauses the auto-dismiss clock the instant a finger touches the card, and
  // remembers how much time was left so a quick tap or an aborted swipe can
  // pick the countdown back up instead of restarting it.
  const pause = () => {
    if (dismissedRef.current) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    remainingRef.current = Math.max(remainingRef.current - (Date.now() - lastResumeAtRef.current), 0);
    cancelAnimation(progress);
  };

  const resume = () => {
    if (dismissedRef.current) return;
    if (remainingRef.current <= 0) {
      runDismiss();
      return;
    }
    lastResumeAtRef.current = Date.now();
    timerRef.current = setTimeout(runDismiss, remainingRef.current);
    progress.value = withTiming(0, { duration: remainingRef.current, easing: Easing.linear });
  };

  useEffect(() => {
    enter.value = withSpring(1, { damping: 16, stiffness: 180, mass: 0.9 });
    lastResumeAtRef.current = Date.now();
    timerRef.current = setTimeout(runDismiss, duration);
    progress.value = withTiming(0, { duration, easing: Easing.linear });
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleTap = () => {
    item.onPress?.();
    runDismiss();
  };

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-18, 18])
    .onBegin(() => {
      runOnJS(pause)();
    })
    .onUpdate((e) => {
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      const shouldDismiss = Math.abs(e.translationX) > screenWidth * 0.25 || Math.abs(e.velocityX) > 800;
      if (shouldDismiss) {
        translateX.value = withTiming((e.translationX < 0 ? -1 : 1) * screenWidth, {
          duration: 200,
          easing: Easing.out(Easing.cubic),
        });
        runOnJS(runDismiss)();
      } else {
        translateX.value = withSpring(0, { damping: 18, stiffness: 260 });
      }
    })
    .onFinalize(() => {
      runOnJS(resume)();
    });

  const cardStyle = useAnimatedStyle(() => {
    const edgeOffset = isBottom ? 36 : -36;
    return {
      opacity: enter.value,
      transform: [
        { translateY: interpolate(enter.value, [0, 1], [edgeOffset, 0]) },
        { scale: interpolate(enter.value, [0, 1], [0.92, 1]) },
        { translateX: translateX.value },
      ],
    };
  });

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View layout={LinearTransition.springify().damping(18).stiffness(180)} style={cardStyle}>
        <Pressable
          onPress={handleTap}
          accessibilityRole="alert"
          style={({ pressed }) => [
            styles.card,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.border,
              shadowColor: colors.shadow,
              opacity: pressed ? 0.96 : 1,
            },
          ]}
        >
          <View style={[styles.accentBar, { backgroundColor: accent }]} />

          <View style={styles.row}>
            <View style={[styles.iconBadge, { backgroundColor: withAlpha(accent, '20') }]}>
              <IIcon name={iconName} size={18} color={accent} />
            </View>

            <View style={styles.textCol}>
              {item.title ? (
                <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
                  {item.title}
                </Text>
              ) : null}
              <Text style={[styles.message, { color: colors.textSecondary }]} numberOfLines={3}>
                {item.message}
              </Text>
            </View>

            <Pressable
              onPress={runDismiss}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.closeBtn}
            >
              <IIcon name="close" size={15} color={colors.textTertiary} />
            </Pressable>
          </View>

          <View style={[styles.progressTrack, { backgroundColor: colors.divider }]}>
            <Animated.View style={[styles.progressFill, { backgroundColor: accent }, progressStyle]} />
          </View>
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
};

const ToastStack = ({
  toasts,
  isBottom,
  topInset,
  bottomInset,
  colors,
  onDismiss,
}: {
  toasts: ToastItem[];
  isBottom: boolean;
  topInset: number;
  bottomInset: number;
  colors: ThemeColors;
  onDismiss: (id: number) => void;
}) => {
  if (!toasts.length) return null;

  // Newest toast is always index 0. For a top stack it should render first
  // (closest to the top edge); for a bottom stack it should render last
  // (closest to the bottom edge), so reverse the render order there.
  const ordered = isBottom ? [...toasts].reverse() : toasts;

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.stackContainer,
        isBottom ? { bottom: bottomInset + 20 } : { top: topInset + 16 },
      ]}
    >
      {ordered.map((item) => (
        <ToastCard key={item.id} item={item} colors={colors} isBottom={isBottom} onDismiss={() => onDismiss(item.id)} />
      ))}
    </View>
  );
};

export const Toastx = () => {
  const { colors } = useTheme();
  const inset = useSafeAreaInsets();
  const [topToasts, setTopToasts] = useState<ToastItem[]>([]);
  const [bottomToasts, setBottomToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    pushToast = (opts: ToastOptions) => {
      const item: ToastItem = { ...opts, id: ++idSeed };
      const setter = opts.position === 'bottom' ? setBottomToasts : setTopToasts;
      setter((prev) => [item, ...prev].slice(0, MAX_STACK));
    };
  }, []);

  const dismissTop = (id: number) => setTopToasts((prev) => prev.filter((t) => t.id !== id));
  const dismissBottom = (id: number) => setBottomToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <>
      <ToastStack
        toasts={topToasts}
        isBottom={false}
        topInset={inset.top}
        bottomInset={inset.bottom}
        colors={colors}
        onDismiss={dismissTop}
      />
      <ToastStack
        toasts={bottomToasts}
        isBottom
        topInset={inset.top}
        bottomInset={inset.bottom}
        colors={colors}
        onDismiss={dismissBottom}
      />
    </>
  );
};

Toastx.show = (options: ToastOptions) => {
  if (pushToast) {
    pushToast(options);
  } else {
    console.warn('Toast is not mounted yet.');
  }
};

const styles = StyleSheet.create({
  stackContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 1000,
    alignItems: 'center',
    gap: 10,
  },
  card: {
    minWidth: screenWidth / 1.15,
    maxWidth: screenWidth - 28,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowOpacity: 0.16,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 8,
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 13,
    paddingLeft: 16,
    paddingRight: 10,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    gap: 2,
    paddingTop: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  message: {
    fontSize: 13.5,
    fontWeight: '500',
    lineHeight: 18,
  },
  closeBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  progressTrack: {
    height: 3,
    width: '100%',
  },
  progressFill: {
    height: 3,
  },
});
