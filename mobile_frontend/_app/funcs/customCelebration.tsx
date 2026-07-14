import React, { useEffect, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import IIcon from 'react-native-vector-icons/Ionicons';
import Animated, {
    Easing,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withSequence,
    withTiming,
} from 'react-native-reanimated';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const CONFETTI_COLORS = ['#f95464', '#0ea5e9', '#22c55e', '#facc15', '#c935ae', '#ffffff'];

// ---------- Confetti burst (used for "It's a match!") ----------

function ConfettiPiece({ delay, color, left, round }: { delay: number; color: string; left: number; round: boolean }) {
    const translateY = useSharedValue(-40);
    const translateX = useSharedValue(0);
    const rotate = useSharedValue(0);
    const opacity = useSharedValue(1);

    useEffect(() => {
        const fallDuration = 2000 + Math.random() * 900;
        const sway = 40 + Math.random() * 40;
        translateY.value = withDelay(delay, withTiming(SCREEN_H * 0.7, { duration: fallDuration, easing: Easing.in(Easing.quad) }));
        translateX.value = withDelay(delay, withSequence(
            withTiming(sway, { duration: fallDuration / 2, easing: Easing.inOut(Easing.quad) }),
            withTiming(-sway, { duration: fallDuration / 2, easing: Easing.inOut(Easing.quad) }),
        ));
        rotate.value = withDelay(delay, withTiming(360 * (Math.random() > 0.5 ? 3 : -3), { duration: fallDuration, easing: Easing.linear }));
        opacity.value = withDelay(delay + fallDuration * 0.75, withTiming(0, { duration: fallDuration * 0.25 }));
    }, []);

    const style = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [
            { translateY: translateY.value },
            { translateX: translateX.value },
            { rotate: `${rotate.value}deg` },
        ],
    }));

    return (
        <Animated.View
            style={[
                styles.confettiPiece,
                style,
                { left, backgroundColor: color, borderRadius: round ? 6 : 2, width: round ? 9 : 7, height: round ? 9 : 13 },
            ]}
        />
    );
}

/** Renders a full-screen confetti rain. Re-fires every time `trigger` changes to a truthy value. */
export function ConfettiBurst({ trigger, count = 55 }: { trigger: any; count?: number }) {
    const [pieces, setPieces] = useState<any[]>([]);

    useEffect(() => {
        if (!trigger) return;
        const arr = Array.from({ length: count }).map((_, i) => ({
            id: `${String(trigger)}-${i}`,
            delay: Math.random() * 450,
            color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            left: Math.random() * SCREEN_W,
            round: Math.random() > 0.5,
        }));
        setPieces(arr);
        const t = setTimeout(() => setPieces([]), 3600);
        return () => clearTimeout(t);
    }, [trigger]);

    if (pieces.length === 0) return null;

    return (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {pieces.map((p) => <ConfettiPiece key={p.id} delay={p.delay} color={p.color} left={p.left} round={p.round} />)}
        </View>
    );
}

// ---------- Action burst (used for like / dislike / superlike taps) ----------

export type ActionBurstKind = 'like' | 'dislike' | 'superlike';

type BurstConfig = { icon: string; color: string };

const BURST_CONFIG: Record<ActionBurstKind, BurstConfig> = {
    like: { icon: 'heart', color: '#22c55e' },
    dislike: { icon: 'close', color: '#f43f5e' },
    superlike: { icon: 'rose', color: '#e11d48' },
};

function BurstParticle({ angle, color, iconName, delay }: { angle: number; color: string; iconName: string; delay: number }) {
    const distance = 55 + Math.random() * 35;
    const tx = Math.cos(angle) * distance;
    const ty = Math.sin(angle) * distance;
    const progress = useSharedValue(0);
    const opacity = useSharedValue(0);

    useEffect(() => {
        opacity.value = withDelay(delay, withSequence(withTiming(1, { duration: 60 }), withTiming(1, { duration: 220 }), withTiming(0, { duration: 220 })));
        progress.value = withDelay(delay, withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) }));
    }, []);

    const style = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [
            { translateX: progress.value * tx },
            { translateY: progress.value * ty },
            { scale: 0.5 + progress.value * 0.6 },
            { rotate: `${progress.value * 140}deg` },
        ],
    }));

    return (
        <Animated.View style={[styles.particle, style]}>
            <IIcon name={iconName} size={16} color={color} />
        </Animated.View>
    );
}

/**
 * Centered pop + radiating particles, played once per unique `burst.key`.
 * Mount once near the root of a screen and drive it via a single piece of state:
 *   setBurst({ kind: 'like', key: Date.now() })
 */
export function ActionBurstOverlay({ burst, onDone }: { burst: { kind: ActionBurstKind; key: number | string } | null; onDone: () => void }) {
    const scale = useSharedValue(0);
    const opacity = useSharedValue(0);
    const key = burst?.key;

    useEffect(() => {
        if (!burst) return;
        scale.value = 0;
        opacity.value = 1;
        scale.value = withSequence(
            withTiming(1.3, { duration: 220, easing: Easing.out(Easing.exp) }),
            withTiming(1, { duration: 140 }),
        );
        opacity.value = withDelay(480, withTiming(0, { duration: 220 }, (finished) => {
            if (finished) runOnJS(onDone)();
        }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    const mainStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ scale: scale.value }],
    }));

    if (!burst) return null;
    const cfg = BURST_CONFIG[burst.kind];
    const particleCount = 8;

    return (
        <View pointerEvents="none" style={styles.burstWrap}>
            <Animated.View style={mainStyle}>
                <View style={[styles.burstCircle, { backgroundColor: cfg.color + '26' }]}>
                    <IIcon name={cfg.icon} size={56} color={cfg.color} />
                </View>
            </Animated.View>
            {Array.from({ length: particleCount }).map((_, i) => (
                <BurstParticle
                    key={`${key}-${i}`}
                    angle={(i / particleCount) * Math.PI * 2}
                    color={cfg.color}
                    iconName={cfg.icon}
                    delay={i * 14}
                />
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    confettiPiece: { position: 'absolute', top: 0 },
    burstWrap: {
        position: 'absolute',
        top: '42%',
        left: '50%',
        marginLeft: -55,
        marginTop: -55,
        width: 110,
        height: 110,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
    },
    burstCircle: { width: 110, height: 110, borderRadius: 55, alignItems: 'center', justifyContent: 'center' },
    particle: { position: 'absolute', top: 47, left: 47 },
});
