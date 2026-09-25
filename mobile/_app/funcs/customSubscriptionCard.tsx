import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Linking,
  Platform,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Dialogx } from './customDialog';
import LinearGradient from 'react-native-linear-gradient';
import IIcon from 'react-native-vector-icons/Ionicons';
import { _http_request, cacheStorage, help } from './functions';
import { namer, __CONFIG__ } from './static';
import { useTheme, ThemeColors } from './theme';
import {
  markNoticeAlreadyShown,
  openPaymentPage,
} from './functions/paymentNotices';

// subscriptions.external_platform: 1=stripe, 2=apple, 3=google
const PLATFORM_LABEL: Record<number, string> = {
  1: 'Card via Stripe',
  2: 'App Store',
  3: 'Google Play',
};
// product_list_variant.billing_cycle
const CYCLE_LABEL: Record<number, string> = {
  2: 'week',
  3: '2 weeks',
  4: 'month',
  5: 'year',
};

const formatDate = (value?: string | null) =>
  value
    ? new Date(value).toLocaleDateString(undefined, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : '—';

const planTitle = (tier: string, fallback?: string | null) =>
  tier === 'vip' ? 'VIP' : tier === 'plus' ? 'Plus' : fallback ?? 'Your plan';

/** Where the plan is billed and what it's called, for the helpers below. */
export function describePlan(profile: any) {
  const sub = profile?.subscription ?? null;
  const state = help.getSubscriptionState(profile);
  const pastDue = sub?.status === 'past_due';
  const tier = pastDue
    ? String(sub?.product_name ?? '').toLowerCase()
    : state.tier;
  return {
    sub,
    platform: Number(sub?.platform ?? 0),
    pastDue,
    cancelPending: Boolean(sub?.cancel_at_period_end),
    tier,
    title: planTitle(tier, sub?.product_name),
  };
}

const gatewayCall = async (action: string, subscriptionId?: string) =>
  _http_request({
    customApiUrl: `${__CONFIG__.HTTPS_API_DOMAIN}/api/secure/gateway/${action}`,
    reqType: 'POST',
    bodyArray: { subscriptionId },
  }) as Promise<any>;

const explainFailure = (res: any, fallbackTitle: string) => {
  Dialogx.alert(
    res?.reason === 'manage_in_store'
      ? 'Managed by your app store'
      : fallbackTitle,
    res?.message ??
      "We couldn't reach our payment provider. Check your connection and try again.",
    undefined,
    { tone: res?.reason === 'manage_in_store' ? 'info' : 'error' },
  );
};

/** Opens the App Store / Google Play subscriptions page. */
export function openStoreSubscriptions(platform: number) {
  Linking.openURL(
    platform === 2 || (platform !== 3 && Platform.OS === 'ios')
      ? 'https://apps.apple.com/account/subscriptions'
      : 'https://play.google.com/store/account/subscriptions',
  ).catch(() =>
    Dialogx.alert(
      "Couldn't open your subscriptions",
      'Open your app store and go to Subscriptions.',
      undefined,
      { tone: 'error' },
    ),
  );
}

/**
 * Cancel flow for the Settings danger zone: confirms, cancels at period end, then
 * reports the result. Store-billed plans are sent to the store instead.
 */
export async function confirmCancelPlan(
  profile: any,
  onChanged: (freshProfile: any) => void,
) {
  const { sub, platform, title, pastDue } = describePlan(profile);
  if (!sub) return;
  if (platform !== 1) {
    const ok = await Dialogx.confirm({
      title: `Cancel ${title}`,
      message: `${title} is billed through ${
        platform === 2 ? 'the App Store' : 'Google Play'
      }, so it's cancelled there.`,
      confirmText: `Open ${platform === 2 ? 'App Store' : 'Google Play'}`,
      tone: 'info',
      icon: 'storefront',
    });
    if (ok) openStoreSubscriptions(platform);
    return;
  }
  const ok = await Dialogx.confirm({
    title: `Cancel ${title}?`,
    message: pastDue
      ? `Your ${title} renewal failed. Cancelling stops further payment attempts and ends the plan.`
      : `You'll keep ${title} until ${formatDate(
          sub?.end_date,
        )}. After that it won't renew and you won't be charged again.`,
    confirmText: 'Cancel plan',
    cancelText: `Keep ${title}`,
    destructive: true,
    icon: 'close-circle',
  });
  if (!ok) return;
  const res = await gatewayCall('cancel-subscription', sub?.id);
  if (res?.code !== 200) {
    explainFailure(res, "Couldn't cancel your plan");
    return;
  }
  const fresh = await cacheStorage
    .getCurrentUserProfile(true)
    .catch(() => null);
  if (fresh) onChanged(fresh);
  markNoticeAlreadyShown('subscription_cancel_scheduled');
  Dialogx.alert(
    `${title} won't renew`,
    res?.message ??
      `You'll keep ${title} until the end of this billing period.`,
    [{ text: 'OK' }],
    { tone: 'info', icon: 'calendar' },
  );
}

/**
 * The user's plan in Settings: what they have, when it renews or ends, how it's
 * billed, and every action on it (cancel / keep, fix a failed payment, manage
 * billing, upgrade). The server enforces all of these; this only presents them.
 */
export function SubscriptionCard({
  profile,
  navigation,
  onChanged,
}: {
  profile: any;
  navigation: any;
  onChanged: (freshProfile: any) => void;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const [busy, setBusy] = useState<string | null>(null);

  const state = help.getSubscriptionState(profile);
  const {
    sub,
    platform,
    pastDue,
    cancelPending,
    tier: tierForTitle,
    title,
  } = describePlan(profile);
  const isStripe = platform === 1;

  const refresh = async () => {
    const fresh = await cacheStorage
      .getCurrentUserProfile(true)
      .catch(() => null);
    if (fresh) onChanged(fresh);
  };

  const callGateway = async (action: string) => {
    setBusy(action);
    try {
      return await gatewayCall(action, sub?.id);
    } finally {
      setBusy(null);
    }
  };

  const resumePlan = async () => {
    const res = await callGateway('resume-subscription');
    if (res?.code === 200) await refresh();
    else explainFailure(res, "Couldn't turn renewal back on");
  };

  const manageBilling = async () => {
    const res = await callGateway('manage-billing');
    if (res?.code === 301 && res?.url) openPaymentPage(res.url);
    else explainFailure(res, "Couldn't open billing");
  };

  // ── Free: no plan ─────────────────────────────────────────────────────────
  if (!sub) {
    return (
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.freeCard}
      >
        <View style={s.rowCenter}>
          <View style={s.freeIcon}>
            <IIcon name="diamond-outline" size={20} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.freeTitle}>You're on Free</Text>
            <Text style={s.freeSubtitle}>
              See who likes you, unlimited likes, more roses and direct
              messages.
            </Text>
          </View>
        </View>
        <Pressable
          style={({ pressed }) => [s.freeButton, pressed && { opacity: 0.85 }]}
          onPress={() => navigation.navigate(namer.navigation.subscription)}
        >
          <Text style={s.freeButtonText}>See plans</Text>
        </Pressable>
      </LinearGradient>
    );
  }

  // ── Has a plan ────────────────────────────────────────────────────────────
  const statusPill = pastDue
    ? { label: 'Payment failed', color: colors.danger }
    : cancelPending
    ? { label: 'Ending', color: colors.warning }
    : { label: 'Active', color: colors.success };
  const cycle = CYCLE_LABEL[Number(sub?.billing_cycle)] ?? null;
  const price =
    typeof sub?.plan_price === 'number' && cycle
      ? `$${sub.plan_price.toFixed(2)} / ${cycle}`
      : null;

  return (
    <View style={s.card}>
      <View style={s.rowCenter}>
        <LinearGradient
          colors={
            tierForTitle === 'vip'
              ? ['#E4BE6B', '#BE8C36']
              : [colors.gradientStart, colors.gradientEnd]
          }
          style={s.planIcon}
        >
          <IIcon
            name={tierForTitle === 'vip' ? 'star' : 'diamond'}
            size={20}
            color="#fff"
          />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={s.planTitle}>{title}</Text>
          <Text style={s.planSubtitle}>
            {[sub?.plan_name, price].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <View style={[s.pill, { backgroundColor: statusPill.color + '22' }]}>
          <View style={[s.pillDot, { backgroundColor: statusPill.color }]} />
          <Text style={[s.pillText, { color: statusPill.color }]}>
            {statusPill.label}
          </Text>
        </View>
      </View>

      {pastDue && (
        <View style={s.alertBox}>
          <IIcon name="alert-circle" size={18} color={colors.danger} />
          <Text style={s.alertText}>
            Your last renewal payment failed, so your {title} perks are paused.
            Update your payment method and we'll retry it.
          </Text>
        </View>
      )}

      <View style={s.details}>
        <DetailRow
          s={s}
          label={
            pastDue
              ? 'Paid through'
              : cancelPending
              ? 'Access until'
              : 'Renews on'
          }
          value={formatDate(sub?.end_date)}
        />
        <DetailRow
          s={s}
          label="Billed through"
          value={PLATFORM_LABEL[platform] ?? '—'}
        />
      </View>

      <View style={s.actions}>
        {!isStripe ? (
          <ActionButton
            s={s}
            colors={colors}
            icon="open-outline"
            label={`Manage in ${platform === 2 ? 'App Store' : 'Google Play'}`}
            onPress={() => openStoreSubscriptions(platform)}
          />
        ) : (
          <>
            {pastDue && (
              <ActionButton
                s={s}
                colors={colors}
                primary
                icon="card-outline"
                label="Update payment method"
                busy={busy === 'manage-billing'}
                onPress={manageBilling}
              />
            )}
            {!pastDue && cancelPending && (
              <ActionButton
                s={s}
                colors={colors}
                primary
                icon="refresh"
                label="Turn renewal back on"
                busy={busy === 'resume-subscription'}
                onPress={resumePlan}
              />
            )}
            {!pastDue && !cancelPending && state.isPlus && (
              <ActionButton
                s={s}
                colors={colors}
                primary
                icon="star-outline"
                label="Upgrade to VIP"
                onPress={() =>
                  navigation.navigate(namer.navigation.subscription, {
                    tab: 'vip',
                  })
                }
              />
            )}
          </>
        )}
      </View>
    </View>
  );
}

function DetailRow({
  s,
  label,
  value,
}: {
  s: ReturnType<typeof createStyles>;
  label: string;
  value: string;
}) {
  return (
    <View style={s.detailRow}>
      <Text style={s.detailLabel}>{label}</Text>
      <Text style={s.detailValue}>{value}</Text>
    </View>
  );
}

function ActionButton({
  s,
  colors,
  icon,
  label,
  onPress,
  busy,
  primary,
  danger,
}: {
  s: ReturnType<typeof createStyles>;
  colors: ThemeColors;
  icon: string;
  label: string;
  onPress: () => void;
  busy?: boolean;
  primary?: boolean;
  danger?: boolean;
}) {
  const fg = primary ? colors.onPrimary : danger ? colors.danger : colors.text;
  return (
    <Pressable
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        s.actionButton,
        primary && {
          backgroundColor: colors.primary,
          borderColor: colors.primary,
        },
        pressed && { opacity: 0.8 },
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <IIcon name={icon} size={17} color={fg} />
      )}
      <Text style={[s.actionText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    rowCenter: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.hairline,
      padding: 16,
      gap: 14,
    },
    planIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
    },
    planTitle: { fontSize: 19, fontWeight: '800', color: colors.text },
    planSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
      textTransform: 'capitalize',
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 999,
    },
    pillDot: { width: 6, height: 6, borderRadius: 3 },
    pillText: { fontSize: 12, fontWeight: '700' },
    alertBox: {
      flexDirection: 'row',
      gap: 8,
      padding: 12,
      borderRadius: 14,
      backgroundColor: colors.danger + '14',
    },
    alertText: { flex: 1, fontSize: 13, lineHeight: 18, color: colors.text },
    details: {
      borderRadius: 14,
      backgroundColor: colors.backgroundSecondary,
      paddingHorizontal: 12,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.hairline,
    },
    detailLabel: { fontSize: 13.5, color: colors.textSecondary },
    detailValue: { fontSize: 13.5, fontWeight: '600', color: colors.text },
    actions: { gap: 8 },
    actionButton: {
      height: 46,
      borderRadius: 23,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    actionText: { fontSize: 14.5, fontWeight: '700' },
    freeCard: { borderRadius: 20, padding: 16, gap: 14 },
    freeIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.2)',
    },
    freeTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
    freeSubtitle: {
      fontSize: 13,
      lineHeight: 18,
      color: 'rgba(255,255,255,0.9)',
      marginTop: 2,
    },
    freeButton: {
      height: 44,
      borderRadius: 22,
      backgroundColor: '#fff',
      alignItems: 'center',
      justifyContent: 'center',
    },
    freeButtonText: { fontSize: 15, fontWeight: '800', color: colors.primary },
  });
}
