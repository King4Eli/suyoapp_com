import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Pressable, Text, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import LinearGradient from './customGradient';
import IIcon from 'react-native-vector-icons/Ionicons';
import { _http_request, cacheStorage, navigationRef } from './functions';
import { Loaderx } from './functions_stateful';
import { Dialogx } from './customDialog';
import { Toastx } from './customNotification';
import { namer, __CONFIG__ } from './static';
import { useTheme } from './theme';
import {
  BoostStatus,
  getBoostState,
  onBoostEnded,
  setBoostState,
  subscribeBoost,
} from './functions/boostStore';

// Boost (api routers/core/pushBoost.js): the profile ranks first in discovery
// for a while. Plus/VIP get one free each week; otherwise purchased boosts.

const pad = (n: number) => String(n).padStart(2, '0');
const formatLeft = (secs: number) =>
  secs >= 3600
    ? `${Math.floor(secs / 3600)}:${pad(Math.floor((secs % 3600) / 60))}:${pad(
        secs % 60,
      )}`
    : `${Math.floor(secs / 60)}:${pad(secs % 60)}`;

const secondsUntil = (iso: string | null | undefined) =>
  iso
    ? Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 1000))
    : 0;

/** Live boost state; re-renders every second while a boost is running. */
export function useBoost() {
  const status = useSyncExternalStore(subscribeBoost, getBoostState);
  const [secondsLeft, setSecondsLeft] = useState(() =>
    secondsUntil(status?.activeUntil),
  );

  useEffect(() => {
    setSecondsLeft(secondsUntil(status?.activeUntil));
    if (!status?.activeUntil) return;
    const timer = setInterval(() => {
      const left = secondsUntil(status.activeUntil);
      setSecondsLeft(left);
      if (left <= 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [status?.activeUntil]);

  const balance = Number(status?.balance ?? 0);
  const weeklyAvailable = !!status?.weekly?.available;
  return {
    status,
    isActive: secondsLeft > 0,
    secondsLeft,
    timeLeft: formatLeft(secondsLeft),
    balance,
    weeklyAvailable,
    canBoost: weeklyAvailable || balance > 0,
  };
}

const openBoostShop = () => {
  if (navigationRef.isReady()) {
    navigationRef.navigate(namer.navigation.consumables, {
      productcategory: namer.productCategoryName.boost,
    });
  }
};

/**
 * Starts a boost after a confirm, or offers to buy one when there are none.
 * `onNeedBoosts` replaces the default (the consumables screen), e.g. Profile
 * opens its own pack sheet.
 */
export async function startBoost(onNeedBoosts: () => void = openBoostShop) {
  const status: BoostStatus | null = getBoostState();
  if (secondsUntil(status?.activeUntil) > 0) {
    Toastx.show({
      type: 'info',
      icon: 'flash',
      title: "You're boosted",
      message: `${formatLeft(
        secondsUntil(status?.activeUntil),
      )} left at the top of discovery.`,
    });
    return;
  }
  const minutes = status?.minutes ?? 30;
  const useWeekly = !!status?.weekly?.available;
  const balance = Number(status?.balance ?? 0);
  if (!useWeekly && balance <= 0) {
    const nextAt = status?.weekly?.nextAt;
    const ok = await Dialogx.confirm({
      title: 'Out of boosts',
      message: `A boost puts you among the top profiles in your area for ${minutes} minutes.${
        nextAt
          ? `\n\nYour free weekly boost is back ${new Date(
              nextAt,
            ).toLocaleDateString(undefined, {
              weekday: 'long',
              hour: 'numeric',
              minute: '2-digit',
            })}.`
          : ''
      }`,
      confirmText: 'Get boosts',
      cancelText: 'Not now',
      icon: 'flash',
    });
    if (ok) onNeedBoosts();
    return;
  }

  const ok = await Dialogx.confirm({
    title: 'Boost your profile?',
    message: useWeekly
      ? `Use your free weekly boost to be one of the top profiles in your area for ${minutes} minutes.`
      : `Use 1 of your ${balance} boost${
          balance === 1 ? '' : 's'
        } to be one of the top profiles in your area for ${minutes} minutes.`,
    confirmText: 'Boost now',
    cancelText: 'Not now',
    icon: 'flash',
  });
  if (!ok) return;

  Loaderx.show();
  try {
    const res: any = await _http_request({
      customApiUrl: __CONFIG__.HTTPS_API_DOMAIN + '/api/core/v1/pushBoost',
      reqType: 'POST',
    });
    setBoostState(res?.boosts);
    cacheStorage.getCurrentUserProfile(true).catch(() => {});
    if (res?.code === 200) {
      Toastx.show({
        type: 'success',
        icon: 'flash',
        title: "You're boosted!",
        message: res?.message ?? `Top of discovery for ${minutes} minutes.`,
      });
    } else if (res?.reason === 'no_boosts') {
      onNeedBoosts();
    } else {
      Toastx.show({
        type: res?.code === 409 ? 'info' : 'error',
        message: res?.message ?? 'Unable to start your boost.',
      });
    }
  } finally {
    Loaderx.hide();
  }
}

// One "boost ended" toast however many screens use the hook.
onBoostEnded(() => {
  Toastx.show({
    type: 'info',
    icon: 'flash-outline',
    title: 'Your boost has ended',
    message: 'Boost again any time from your profile.',
  });
});

// ── Visuals: gold (theme `premium`) means "boosted" everywhere ────────────────

/** 0 → 1 looping, for pulses; stays at 0 when the OS asks for reduced motion. */
function useLoop(durationMs: number, delayMs = 0, running = true) {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (!running || reduceMotion) {
      t.value = 0;
      return;
    }
    t.value = withDelay(
      delayMs,
      withRepeat(
        withTiming(1, {
          duration: durationMs,
          easing: Easing.out(Easing.quad),
        }),
        -1,
        false,
      ),
    );
  }, [running, reduceMotion, durationMs, delayMs, t]);
  return t;
}

/** Twinkling sparkle: grows, spins a little and fades, on a loop. */
function Sparkle({
  size,
  color,
  style,
  delay = 0,
}: {
  size: number;
  color: string;
  style?: any;
  delay?: number;
}) {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) return;
    t.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 600, easing: Easing.out(Easing.back(2)) }),
          withTiming(0.25, {
            duration: 900,
            easing: Easing.inOut(Easing.quad),
          }),
        ),
        -1,
        false,
      ),
    );
  }, [reduceMotion, delay, t]);
  const animated = useAnimatedStyle(() => ({
    opacity: 0.35 + t.value * 0.65,
    transform: [
      { scale: 0.6 + t.value * 0.5 },
      { rotate: `${t.value * 45}deg` },
    ],
  }));
  return (
    <Animated.View style={[{ position: 'absolute' }, style, animated]}>
      <IIcon name="sparkles" size={size} color={color} />
    </Animated.View>
  );
}

/**
 * Wraps an avatar while a boost runs: gold ring, ripples spreading out of it,
 * twinkling sparkles and a lightning badge. Renders just the children otherwise.
 */
export function BoostAura({
  size,
  children,
}: {
  size: number;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const { isActive } = useBoost();
  const ripple1 = useLoop(2200, 0, isActive);
  const ripple2 = useLoop(2200, 1100, isActive);
  const ring1 = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - ripple1.value),
    transform: [{ scale: 1 + ripple1.value * 0.32 }],
  }));
  const ring2 = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - ripple2.value),
    transform: [{ scale: 1 + ripple2.value * 0.32 }],
  }));

  if (!isActive) return <>{children}</>;
  const ring = {
    position: 'absolute' as const,
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: 3,
    borderColor: colors.premium,
  };
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Animated.View pointerEvents="none" style={[ring, ring1]} />
      <Animated.View pointerEvents="none" style={[ring, ring2]} />
      {children}
      <View pointerEvents="none" style={ring} />
      <Sparkle size={16} color={colors.premium} style={{ top: -6, right: 2 }} />
      <Sparkle
        size={11}
        color={colors.premium}
        style={{ bottom: 6, left: -6 }}
        delay={700}
      />
      <View
        pointerEvents="none"
        style={[
          auraStyles.badge,
          { backgroundColor: colors.premium, borderColor: colors.surface },
        ]}
      >
        <IIcon name="flash" size={14} color="#fff" />
      </View>
    </View>
  );
}

/**
 * Banner while a boost runs: what it's doing, time left, and a bar draining
 * towards the end. Renders nothing when there's no boost.
 */
export function BoostBanner({ style }: { style?: any }) {
  const { colors } = useTheme();
  const { isActive, timeLeft, secondsLeft, status } = useBoost();
  const pulse = useLoop(1400, 0, isActive);
  const icon = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + Math.sin(pulse.value * Math.PI) * 0.18 }],
  }));
  if (!isActive) return null;
  const total = Math.max(1, (status?.minutes ?? 30) * 60);
  const fraction = Math.min(1, secondsLeft / total);
  return (
    <Pressable onPress={() => startBoost()} accessibilityRole="button">
      <LinearGradient
        colors={[colors.premium, colors.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[auraStyles.banner, style]}
      >
        <View style={auraStyles.bannerRow}>
          <Animated.View style={[auraStyles.bannerIcon, icon]}>
            <IIcon name="flash" size={20} color="#fff" />
          </Animated.View>
          <View style={{ flex: 1 }}>
            <Text style={auraStyles.bannerTitle}>Your profile is boosted</Text>
            <Text style={auraStyles.bannerText}>
              You're among the top profiles in your area
            </Text>
          </View>
          <Text style={auraStyles.bannerTime}>{timeLeft}</Text>
        </View>
        <View style={auraStyles.track}>
          <View style={[auraStyles.fill, { width: `${fraction * 100}%` }]} />
        </View>
        <Sparkle size={14} color="#fff" style={{ top: 6, right: 70 }} />
        <Sparkle
          size={10}
          color="#fff"
          style={{ bottom: 14, right: 110 }}
          delay={800}
        />
      </LinearGradient>
    </Pressable>
  );
}

const auraStyles = StyleSheet.create({
  badge: {
    position: 'absolute',
    left: 2,
    top: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: {
    borderRadius: 18,
    padding: 14,
    gap: 10,
    overflow: 'hidden',
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bannerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  bannerText: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 13,
    marginTop: 1,
  },
  bannerTime: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
  },
  fill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#fff',
  },
});

/** Header pill shown while a boost is running: pulsing gold glow + countdown. */
export function BoostChip() {
  const { colors } = useTheme();
  const { isActive, timeLeft } = useBoost();
  const pulse = useLoop(1600, 0, isActive);
  const glow = useAnimatedStyle(() => ({
    opacity: 0.6 * (1 - pulse.value),
    transform: [
      { scaleX: 1 + pulse.value * 0.25 },
      { scaleY: 1 + pulse.value * 0.6 },
    ],
  }));
  const bolt = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + Math.sin(pulse.value * Math.PI) * 0.25 }],
  }));
  if (!isActive) return null;
  return (
    <Pressable
      onPress={() => startBoost()}
      accessibilityRole="button"
      accessibilityLabel={`Your profile is boosted, ${timeLeft} left`}
      style={({ pressed }) => pressed && { opacity: 0.8 }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          chipStyles.glow,
          { backgroundColor: colors.premium },
          glow,
        ]}
      />
      <View style={[chipStyles.chip, { backgroundColor: colors.premium }]}>
        <Animated.View style={bolt}>
          <IIcon name="flash" size={14} color="#fff" />
        </Animated.View>
        <Text style={[chipStyles.text, { color: '#fff' }]}>{timeLeft}</Text>
      </View>
    </Pressable>
  );
}

const chipStyles = StyleSheet.create({
  glow: {
    borderRadius: 999,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  text: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
