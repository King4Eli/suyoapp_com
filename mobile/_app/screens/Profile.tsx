import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Dialogx } from '../funcs/customDialog';
import { useFocusEffect } from '@react-navigation/native';
import { SafeImage } from '../funcs/customImage';
import LinearGradient from '../funcs/customGradient';
import LottieView from 'lottie-react-native';
import Svg, { Circle } from 'react-native-svg';
import IIcon from 'react-native-vector-icons/Ionicons';
import MIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  _http_request,
  cacheStorage,
  help,
  logReport,
  parseCategoryProducts,
} from '../funcs/functions';
import { Loaderx } from '../funcs/functions_stateful';
import { ConsumableSheet } from '../funcs/customConsumableSheet';
import { namer, resourceMap, styles, __CONFIG__ } from '../funcs/static';
import { useTheme, ThemeColors, spacing } from '../funcs/theme';
import { HeaderActions, HeaderIconButton } from '../funcs/customHeader';
import { useContentWidth } from '../funcs/responsive';
import { onVerificationChanged } from '../funcs/functions/verificationEvents';
import { BoostAura, BoostBanner, startBoost, useBoost } from '../funcs/boost';

const PLAN_UI: Record<
  string,
  { icon: string; color: string; cardColors: string[] }
> = {
  plus: {
    icon: 'diamond-outline',
    color: '#B79AE0',
    cardColors: ['#2A2430', '#141018'],
  },
  vip: {
    icon: 'crown-outline',
    color: '#C99A3E',
    cardColors: ['#C99A3E', '#8A6A22'],
  },
  free: {
    icon: 'account-heart-outline',
    color: '#E24862',
    cardColors: ['#F0577A', '#B23FA0'],
  },
};

// Day-7 reward circle once reached -- deliberately off-palette so it pops.
const STREAK_REWARD_COLORS = ['#FF3D77', '#FF9F1C'];

const getPlanUi = (plan?: string | null) =>
  PLAN_UI[
    String(plan ?? '')
      .trim()
      .toLowerCase()
  ] ?? PLAN_UI.free;

export function Screen_profile({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const stylesx = useMemo(() => createStylesx(colors), [colors]);
  const contentWidth = useContentWidth();
  // Power-ups: 3 across on tablets, 2 on phones, 1 on the narrowest phones
  // (the last one takes the full row when the count doesn't divide evenly)
  const powerColumns = contentWidth >= 600 ? 3 : contentWidth >= 340 ? 2 : 1;
  const planCardWidth = Math.min(contentWidth * 0.8, 460);
  const [profile, setProfile] = useState<any>(null);
  const [mainSubProducts, setMainSubProducts] = useState<any[]>([]);

  const mapper = cacheStorage.CONFIG.get()?.mapper;
  const imageDomain = mapper?.img_domain ?? '';
  const [buyCategory, setBuyCategory] = useState<string | null>(null);
  const boost = useBoost();

  const profileCore = profile?.profile ?? {};
  const images = Array.isArray(profileCore?.images) ? profileCore.images : [];
  const userVerified = Boolean(profileCore?.verified ?? profile?.user_verified);
  const displayName =
    profileCore?.fullname ?? profile?.user_fullname ?? 'Your profile';
  const displayAge = help.getageFromDOB(
    profileCore?.dob ?? profile?.user_bio_dob ?? '',
  );
  const firstImagePath = images?.[0]?.p ?? images?.[0]?.uri ?? '';
  const firstImageUri = firstImagePath
    ? firstImagePath.startsWith('http')
      ? firstImagePath
      : `${imageDomain}${firstImagePath}`
    : '';

  const subscriptionState = help.getSubscriptionState(profile);
  const activeSubscription = subscriptionState.hasActive;
  const subscriptionPlanUi = getPlanUi(subscriptionState.tier);

  // Counts come from getProfile; pack prices are loaded from getProducts by
  // ConsumableSheet when one is tapped.
  const roses = profile?.roses;
  const consumableItems = [
    {
      category: namer.productCategoryName.superlike,
      label: 'Roses',
      icon: 'rose',
      subtitle: 'Roses are spent on Super Likes',
      count: Number(roses?.remainingToday ?? 0) + Number(roses?.balance ?? 0),
    },
    {
      category: namer.productCategoryName.boost,
      label: 'Boost',
      icon: 'flash',
      subtitle: 'Be one of the top profiles in your area',
      count: boost.balance,
      // Tapping a boost uses one; the + buys more.
      status: boost.isActive
        ? `Active · ${boost.timeLeft} left`
        : boost.weeklyAvailable
        ? `${boost.balance} available · 1 free`
        : undefined,
      active: boost.isActive,
      onPress: () =>
        startBoost(() => setBuyCategory(namer.productCategoryName.boost)),
    },
    {
      category: namer.productCategoryName.directmessage,
      label: 'Direct Messages',
      icon: 'chatbubble-ellipses',
      subtitle: 'Message someone before you match',
      count:
        Number(profile?.directMessages?.remainingToday ?? 0) +
        Number(profile?.directMessages?.balance ?? 0),
    },
  ];
  const buyItem = consumableItems.find(item => item.category === buyCategory);

  // 7-day streak (Redis-backed, see api/global/streaks.js): any action on the
  // Peoples screen counts the day; the reward amounts come from the server.
  const streak = profile?.stats?.streak;
  const streakDays = Number(streak?.days ?? 7);
  const streakCount = Number(streak?.count ?? 0);
  const streakRewardsPending = Number(streak?.rewardsPending ?? 0);
  // Once complete, amounts cover every unclaimed reward.
  const streakRewardMultiplier = Math.max(1, streakRewardsPending);
  const streakRewards = [
    {
      key: 'roses',
      icon: 'rose',
      singular: 'Rose',
      plural: 'Roses',
      amount: Number(streak?.reward?.roses ?? 0) * streakRewardMultiplier,
    },
    {
      key: 'directMessages',
      icon: 'chatbubble-ellipses',
      singular: 'Direct Message',
      plural: 'Direct Messages',
      amount:
        Number(streak?.reward?.directMessages ?? 0) * streakRewardMultiplier,
    },
  ].filter(item => item.amount > 0);

  const refreshProfile = async () => {
    try {
      const freshProfile = await cacheStorage.getCurrentUserProfile(true);
      setProfile(freshProfile);
    } catch {
      // keep showing the last known profile if the refresh itself fails
    }
  };

  // An admin reviewed the selfie while this screen is open: show the badge now.
  useEffect(() => onVerificationChanged(refreshProfile), []);

  const claimStreakReward = async () => {
    Loaderx.show();
    const response: any = await _http_request({
      customApiUrl:
        __CONFIG__.HTTPS_API_DOMAIN + '/api/core/v1/pushClaimStreakReward',
      reqType: 'POST',
    });
    await refreshProfile();
    Loaderx.hide();
    if (response?.code === 200) {
      const gotRoses = Number(response?.granted?.roses ?? 0);
      const gotDirectMessages = Number(response?.granted?.directMessages ?? 0);
      Dialogx.alert(
        'Reward claimed!',
        [
          gotRoses > 0 && `+${gotRoses} roses`,
          gotDirectMessages > 0 &&
            `+${gotDirectMessages} direct message${
              gotDirectMessages === 1 ? '' : 's'
            }`,
        ]
          .filter(Boolean)
          .join('\n') || 'Enjoy your reward.',
        [{ text: 'Awesome' }],
        { tone: 'success', icon: 'gift' },
      );
    } else {
      Dialogx.alert(
        "Couldn't claim your reward",
        response?.message ?? 'Please try again.',
        undefined,
        { tone: 'error' },
      );
    }
  };

  const visibleMainSubProducts = useMemo(() => {
    if (subscriptionState.isVip) return [];
    if (subscriptionState.isPlus) {
      return mainSubProducts.filter(
        (tier: any) =>
          String(tier?.name ?? '')
            .trim()
            .toLowerCase() === 'vip',
      );
    }
    return mainSubProducts;
  }, [mainSubProducts, subscriptionState.isPlus, subscriptionState.isVip]);

  // Computed by the server from the saved profile (api global/profileCompleteness.js),
  // with the missing items ordered by how much each would add.
  const completeness = profile?.completeness;
  const profileCompletion = Math.max(
    0,
    Math.min(100, Number(completeness?.percent ?? 0)),
  );
  const missingItems: any[] = Array.isArray(completeness?.missing)
    ? completeness.missing
    : [];
  const openCompletenessItem = (item: any) =>
    item?.action === 'verify'
      ? navigation.navigate(namer.navigation.verifyProfile)
      : navigation.navigate(namer.navigation.editprofile, {
          focusSection:
            item?.action === 'editprofile' ? item?.key : item?.action,
        });
  // verified | pending | rejected | none (api global/verification.js)
  const verificationStatus: string = profile?.verification?.status ?? 'none';

  useFocusEffect(
    React.useCallback(() => {
      let mounted = true;

      (async () => {
        try {
          const [products, freshProfile] = await Promise.all([
            (async () => {
              const raw = await cacheStorage.getProducts();
              return parseCategoryProducts(
                raw,
                namer.productCategoryName.mainsub,
              );
            })(),
            cacheStorage.getCurrentUserProfile(),
          ]);

          if (mounted) {
            setMainSubProducts(Array.isArray(products) ? products : []);
            setProfile(freshProfile);
          }
        } catch {
          if (mounted) {
            setMainSubProducts([]);
            setProfile(null);
          }
        }
      })();

      return () => {
        mounted = false;
      };
    }, []),
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: '',
      headerRight: () => (
        <HeaderActions>
          <HeaderIconButton
            family="mci"
            name="cog-outline"
            onPress={() => navigation.navigate(namer.navigation.settings)}
          />
        </HeaderActions>
      ),
    });
  }, [navigation, colors, stylesx]);

  if (profile === null) {
    return (
      <View style={stylesx.loadingWrap}>
        <LottieView
          source={resourceMap.lottie.infinityLoading}
          autoPlay
          loop
          style={{ width: 220, height: 220 }}
        />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { paddingLeft: 0, paddingRight: 0, backgroundColor: colors.background },
      ]}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.conainerScrollView,
          { gap: 14, paddingTop: spacing.sm, paddingBottom: 10 },
        ]}
      >
        <BoostBanner />

        <View style={stylesx.profileCard}>
          <View style={stylesx.profileRow}>
            <Pressable
              onPress={() => navigation.navigate(namer.navigation.editprofile)}
            >
              <View style={stylesx.avatarWrap}>
                <CircularProgress
                  progress={profileCompletion}
                  color={colors.primary}
                  trackColor={colors.border}
                  styleProp={stylesx.progressCircle}
                />
                <BoostAura size={100}>
                  {firstImageUri ? (
                    <SafeImage
                      style={stylesx.avatar}
                      resizeMode="cover"
                      source={{ uri: firstImageUri }}
                      onError={() =>
                        logReport({
                          type: 'http -image',
                          logMessage: 'Image load',
                          url: firstImageUri,
                          useraction: 'Image Load',
                        })
                      }
                    />
                  ) : (
                    <View style={[stylesx.avatar, stylesx.avatarEmpty]}>
                      <MIcon
                        name="account-heart-outline"
                        size={42}
                        color={colors.primary}
                      />
                    </View>
                  )}
                </BoostAura>
                {userVerified && (
                  <View style={stylesx.verifiedBadge}>
                    <IIcon
                      name="checkmark-done-circle-sharp"
                      size={28}
                      color={colors.accent}
                    />
                  </View>
                )}
              </View>
            </Pressable>

            <View style={stylesx.profileInfo}>
              <Text style={stylesx.profileName} numberOfLines={1}>
                {displayName}
                {displayAge ? `, ${displayAge}` : ''}
              </Text>
              <View style={stylesx.subscriptionBadge}>
                <MIcon
                  name={subscriptionPlanUi.icon}
                  size={15}
                  color={subscriptionPlanUi.color}
                />
                <Text style={stylesx.subscriptionBadgeText}>
                  {activeSubscription
                    ? `${subscriptionState.plan} ${
                        subscriptionState.variant ?? ''
                      }`.trim()
                    : 'Free plan'}
                </Text>
              </View>
              <Text
                style={[
                  stylesx.completionText,
                  profileCompletion === 100 && { color: colors.success },
                ]}
              >
                {profileCompletion === 100
                  ? 'Profile complete'
                  : `${profileCompletion}% profile complete`}
              </Text>
            </View>
          </View>

          <View style={stylesx.actionRow}>
            <ProfileAction
              icon="square-edit-outline"
              label="Edit Profile"
              onPress={() => navigation.navigate(namer.navigation.editprofile)}
              stylesx={stylesx}
              secondaryColor={colors.accent}
            />
            {!userVerified && (
              <ProfileAction
                icon={
                  verificationStatus === 'pending'
                    ? 'clock-outline'
                    : 'camera-outline'
                }
                label={
                  verificationStatus === 'pending'
                    ? 'Verification pending'
                    : 'Verify Account'
                }
                secondary
                onPress={() =>
                  navigation.navigate(namer.navigation.verifyProfile)
                }
                stylesx={stylesx}
                secondaryColor={colors.accent}
              />
            )}
          </View>
        </View>

        {completeness && missingItems.length > 0 && (
          <View style={stylesx.card}>
            <SectionHeader
              title="Complete your profile"
              hint="Complete profiles get more likes and better matches."
              icon="account-check-outline"
              colors={colors}
              stylesx={stylesx}
            />
            <View style={stylesx.completenessBarTrack}>
              <View
                style={[
                  stylesx.completenessBarFill,
                  { width: `${profileCompletion}%` },
                ]}
              />
            </View>
            {missingItems.slice(0, 3).map((item: any, idx: number) => (
              <Pressable
                key={item.key}
                onPress={() => openCompletenessItem(item)}
                style={({ pressed }) => [
                  stylesx.completenessRow,
                  idx > 0 && stylesx.completenessRowBorder,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <View style={stylesx.completenessIcon}>
                  <MIcon
                    name={COMPLETENESS_ICONS[item.key] ?? 'plus'}
                    size={18}
                    color={colors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={stylesx.completenessLabel}>{item.label}</Text>
                  <Text style={stylesx.completenessHint}>{item.hint}</Text>
                </View>
                <Text style={stylesx.completenessGain}>
                  +{Math.round(item.weight * (1 - item.progress))}%
                </Text>
                <IIcon
                  name="chevron-forward"
                  size={18}
                  color={colors.textTertiary}
                />
              </Pressable>
            ))}
          </View>
        )}

        <View style={stylesx.card}>
          <SectionHeader title="Power-ups" colors={colors} stylesx={stylesx} />
          <View style={stylesx.powerGrid}>
            {consumableItems.map((item: any) => (
              <Pressable
                key={item.category}
                style={[
                  stylesx.productPill,
                  { flexBasis: `${100 / powerColumns - 4}%` },
                  item.active && {
                    borderColor: colors.primary,
                    borderWidth: 1.5,
                  },
                ]}
                onPress={item.onPress ?? (() => setBuyCategory(item.category))}
              >
                <IIcon name={item.icon} size={22} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={stylesx.productLabel} numberOfLines={1}>
                    {item.label}
                  </Text>
                  <Text
                    style={[
                      stylesx.productCount,
                      item.active && {
                        color: colors.primary,
                        fontWeight: '700',
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {item.status ?? `${item.count} available`}
                  </Text>
                </View>
                <Pressable
                  hitSlop={8}
                  onPress={() => setBuyCategory(item.category)}
                  accessibilityLabel={`Buy ${item.label}`}
                >
                  <IIcon name="add-circle" size={22} color={colors.primary} />
                </Pressable>
              </Pressable>
            ))}
          </View>
        </View>

        {visibleMainSubProducts.length > 0 && (
          // show items
          <View style={stylesx.planCardsWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[
                stylesx.planCardsContent,
                visibleMainSubProducts.length === 1 &&
                  stylesx.singlePlanCardsContent,
              ]}
              style={stylesx.planCardsScroll}
            >
              {visibleMainSubProducts.map((tier: any, index: number) => {
                const tierName = String(tier?.name ?? '').trim();
                const tierUi = getPlanUi(tierName);
                const isCurrentTier =
                  activeSubscription &&
                  subscriptionState.tier === tierName.toLowerCase();
                const features = (tier?.description?.features ?? [])
                  .filter(
                    (feature: any) =>
                      feature?.e !== false &&
                      String(feature?.d ?? '').trim().length > 0,
                  )
                  .map((feature: any) => feature.d)
                  .slice(0, 4);

                return (
                  <LinearGradient
                    key={tier?.sku ?? index}
                    colors={tierUi.cardColors}
                    style={[
                      stylesx.planCard,
                      { width: planCardWidth },
                      visibleMainSubProducts.length === 1 &&
                        stylesx.singlePlanCard,
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <View style={stylesx.planHeader}>
                      <Text style={stylesx.planTitle}>
                        {tierName || 'Upgrade'}
                      </Text>
                      <MIcon name={tierUi.icon} size={22} color="#fff" />
                    </View>

                    <View style={stylesx.featuresList}>
                      {features.length > 0 ? (
                        features.map(
                          (feature: string, featureIndex: number) => (
                            <View
                              key={`${feature}-${featureIndex}`}
                              style={stylesx.featureItem}
                            >
                              <IIcon
                                name="checkmark-circle"
                                size={16}
                                color="#fff"
                              />
                              <Text style={stylesx.featureText}>{feature}</Text>
                            </View>
                          ),
                        )
                      ) : (
                        <Text style={stylesx.featureText}>
                          No features configured
                        </Text>
                      )}
                    </View>

                    <TouchableOpacity
                      style={[
                        stylesx.upgradeButton,
                        isCurrentTier && stylesx.currentPlanButton,
                      ]}
                      disabled={isCurrentTier}
                      onPress={() =>
                        navigation.navigate(namer.navigation.subscription, {
                          tab: tier?.name,
                        })
                      }
                    >
                      <Text style={stylesx.upgradeButtonText}>
                        {isCurrentTier ? 'Current plan' : 'Upgrade'}
                      </Text>
                    </TouchableOpacity>
                  </LinearGradient>
                );
              })}
            </ScrollView>
          </View>
        )}

        <View style={stylesx.card}>
          <SectionHeader
            title={`${streakDays} day streak`}
            icon="fire"
            colors={colors}
            stylesx={stylesx}
          />
          <View style={stylesx.streakRow}>
            {Array.from({ length: streakDays }).map((_, index) => {
              const isActive = index < streakCount;
              const isRewardDay = index === streakDays - 1;
              if (isRewardDay && isActive) {
                return (
                  <LinearGradient
                    key={index}
                    colors={STREAK_REWARD_COLORS}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[stylesx.streakDot, stylesx.streakRewardDotActive]}
                  >
                    <MIcon name="gift" size={26} color="#fff" />
                  </LinearGradient>
                );
              }
              return (
                <View
                  key={index}
                  style={[
                    stylesx.streakDot,
                    isActive && stylesx.streakDotActive,
                    isRewardDay && stylesx.streakRewardDot,
                  ]}
                >
                  <MIcon
                    name={isRewardDay ? 'gift-outline' : 'fire'}
                    size={isRewardDay ? 21 : 23}
                    color={
                      isActive || isRewardDay
                        ? colors.premium
                        : colors.textTertiary
                    }
                  />
                </View>
              );
            })}
          </View>
          {streakRewards.length > 0 && (
            <View
              style={[
                stylesx.streakRewards,
                streakRewardsPending > 0 && stylesx.streakRewardsEarned,
              ]}
            >
              <Text style={stylesx.streakRewardsTitle}>
                {streakRewardsPending > 0
                  ? 'Streak complete! You earned'
                  : `Day ${streakDays} rewards`}
              </Text>
              <View style={stylesx.streakRewardsList}>
                {streakRewards.map(item => (
                  <View key={item.key} style={stylesx.streakRewardItem}>
                    <IIcon name={item.icon} size={18} color={colors.premium} />
                    <Text style={stylesx.streakRewardAmount}>
                      +{item.amount}
                    </Text>
                    <Text style={stylesx.streakRewardLabel}>
                      {item.amount === 1 ? item.singular : item.plural}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          {streakRewardsPending > 0 && (
            <TouchableOpacity
              style={stylesx.streakClaimButton}
              onPress={claimStreakReward}
            >
              <MIcon name="gift" size={18} color={colors.onPrimary} />
              <Text style={stylesx.streakClaimText}>
                Claim reward
                {streakRewardsPending > 1 ? ` x${streakRewardsPending}` : ''}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      <ConsumableSheet
        visible={!!buyItem}
        category={buyItem?.category ?? ''}
        title={buyItem?.label ?? ''}
        subtitle={buyItem?.subtitle}
        icon={buyItem?.icon ?? 'flash'}
        onClose={() => setBuyCategory(null)}
        onPurchased={refreshProfile}
      />
    </View>
  );
}

const CircularProgress = ({
  size = 112,
  strokeWidth = 3,
  progress = 0,
  color,
  trackColor,
  styleProp,
}: {
  size?: number;
  strokeWidth?: number;
  progress?: number;
  color: string;
  trackColor: string;
  styleProp: any;
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <Svg width={size} height={size} style={styleProp}>
      <Circle
        stroke={trackColor}
        fill="none"
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={strokeWidth}
      />
      <Circle
        stroke={color}
        fill="none"
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={strokeWidth}
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
};

// MaterialCommunityIcons per completeness item key
const COMPLETENESS_ICONS: Record<string, string> = {
  photos: 'image-multiple-outline',
  about: 'text-account',
  prompts: 'comment-quote-outline',
  interests: 'star-four-points-outline',
  work: 'briefcase-outline',
  basics: 'card-account-details-outline',
  background: 'earth',
};

const ProfileAction = ({
  icon,
  label,
  secondary,
  onPress,
  stylesx,
  secondaryColor,
}: {
  icon: string;
  label: string;
  secondary?: boolean;
  onPress: () => void;
  stylesx: any;
  secondaryColor: string;
}) => (
  <Pressable
    style={({ pressed }) => [
      stylesx.profileAction,
      secondary && stylesx.profileActionSecondary,
      pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
    ]}
    onPress={onPress}
  >
    <MIcon name={icon} size={20} color={secondary ? secondaryColor : '#fff'} />
    <Text
      style={[
        stylesx.profileActionText,
        secondary && stylesx.profileActionTextSecondary,
      ]}
    >
      {label}
    </Text>
  </Pressable>
);

const SectionHeader = ({
  title,
  hint,
  icon,
  colors,
  stylesx,
}: {
  title: string;
  hint?: string;
  icon?: string;
  colors: ThemeColors;
  stylesx: any;
}) => (
  <View style={stylesx.sectionHeader}>
    {icon && (
      <View style={stylesx.sectionIcon}>
        <MIcon name={icon} size={20} color={colors.primary} />
      </View>
    )}
    <View style={{ flex: 1 }}>
      <Text style={stylesx.sectionTitle}>{title}</Text>
      {!!hint && <Text style={stylesx.sectionHint}>{hint}</Text>}
    </View>
  </View>
);

function createStylesx(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.backgroundSecondary,
    },
    loadingWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },

    profileCard: {
      borderRadius: 24,
      backgroundColor: colors.surface,
      padding: 16,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: 0.08,
      shadowRadius: 24,
      elevation: 5,
    },
    profileRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    avatarWrap: {
      width: 112,
      height: 112,
      alignItems: 'center',
      justifyContent: 'center',
    },
    progressCircle: {
      position: 'absolute',
    },
    avatar: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: colors.backgroundSecondary,
    },
    avatarEmpty: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    verifiedBadge: {
      position: 'absolute',
      right: 4,
      bottom: 5,
      borderRadius: 16,
      backgroundColor: colors.surface,
    },
    profileInfo: {
      flex: 1,
      gap: 8,
    },
    profileName: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '900',
      letterSpacing: -0.4,
    },
    completionText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '700',
    },
    completenessBarTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.border,
      overflow: 'hidden',
      marginTop: 4,
      marginBottom: 6,
    },
    completenessBarFill: {
      height: '100%',
      borderRadius: 3,
      backgroundColor: colors.primary,
    },
    completenessRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
    },
    completenessRowBorder: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.hairline,
    },
    completenessIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primarySoft,
    },
    completenessLabel: {
      fontSize: 14.5,
      fontWeight: '700',
      color: colors.text,
    },
    completenessHint: {
      fontSize: 12.5,
      color: colors.textSecondary,
      marginTop: 1,
    },
    completenessGain: {
      fontSize: 12.5,
      fontWeight: '800',
      color: colors.primary,
    },
    subscriptionBadge: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 999,
      paddingHorizontal: 11,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    subscriptionBadgeText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'capitalize',
    },
    actionRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 16,
    },
    profileAction: {
      flex: 1,
      minHeight: 48,
      borderRadius: 16,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 7,
    },
    profileActionSecondary: {
      backgroundColor: colors.accentSoft,
      borderWidth: 1,
      borderColor: colors.accent,
    },
    profileActionText: {
      color: '#fff',
      fontWeight: '900',
    },
    profileActionTextSecondary: {
      color: colors.accent,
    },
    card: {
      borderRadius: 22,
      backgroundColor: colors.surface,
      padding: 16,
      gap: 14,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.06,
      shadowRadius: 20,
      elevation: 4,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    sectionIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundSecondary,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '900',
    },
    sectionHint: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      marginTop: 3,
    },
    powerGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    productPill: {
      flexGrow: 1,
      borderRadius: 16,
      backgroundColor: colors.backgroundSecondary,
      padding: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    productLabel: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '900',
      textTransform: 'capitalize',
    },
    productCount: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      marginTop: 2,
    },
    powerEmpty: {
      minHeight: 76,
      borderRadius: 18,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    powerEmptyIcon: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundSecondary,
    },
    powerEmptyTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '900',
    },
    powerEmptyText: {
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 2,
      fontWeight: '600',
    },
    planCardsWrapper: {
      minHeight: 240,
      marginTop: 8,
    },
    planCardsScroll: {
      flexGrow: 0,
    },
    planCardsContent: {
      gap: 10,
      paddingRight: 16,
      alignItems: 'stretch',
    },
    singlePlanCardsContent: {
      flexGrow: 1,
    },
    planCard: {
      borderRadius: 22,
      padding: 16,
      minHeight: 220,
      justifyContent: 'space-between',
    },
    singlePlanCard: {
      width: undefined,
      flex: 1,
    },
    planHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    planTitle: {
      color: '#fff',
      fontSize: 22,
      fontWeight: '900',
      textTransform: 'capitalize',
    },
    featuresList: {
      gap: 8,
      marginVertical: 16,
    },
    featureItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    featureText: {
      flex: 1,
      color: '#fff',
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    upgradeButton: {
      minHeight: 44,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.22)',
    },
    currentPlanButton: {
      backgroundColor: 'rgba(255,255,255,0.34)',
    },
    upgradeButtonText: {
      color: '#fff',
      fontWeight: '900',
    },
    streakRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 8,
    },
    streakDot: {
      flex: 1,
      // Scales down on small phones; capped so tablets don't get giant circles
      maxWidth: 64,
      aspectRatio: 1,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.border,
    },
    streakDotActive: {
      backgroundColor: colors.backgroundSecondary,
      borderColor: colors.premium,
    },
    streakRewardDot: {
      borderStyle: 'dashed',
      borderWidth: 1.5,
      borderColor: colors.premium,
    },
    streakRewardDotActive: {
      borderWidth: 2,
      borderStyle: 'solid',
      borderColor: '#FFD166',
      transform: [{ scale: 1.12 }],
      shadowColor: '#FF3D77',
      shadowOpacity: 0.6,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 },
      elevation: 8,
    },
    streakRewards: {
      marginTop: 12,
      padding: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundSecondary,
      gap: 10,
    },
    streakRewardsEarned: {
      borderColor: colors.premium,
      backgroundColor: colors.premiumSoft,
    },
    streakRewardsTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '900',
      textAlign: 'center',
    },
    streakRewardsList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 10,
    },
    streakRewardItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    streakRewardAmount: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '900',
    },
    streakRewardLabel: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '700',
    },
    streakClaimButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.premium,
      borderRadius: 14,
      paddingVertical: 12,
      marginTop: 12,
    },
    streakClaimText: {
      color: colors.onPrimary,
      fontSize: 15,
      fontWeight: '900',
    },
  });
}
