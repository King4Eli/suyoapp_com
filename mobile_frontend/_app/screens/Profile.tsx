import React, { useLayoutEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeImage } from '../funcs/customImage';
import LinearGradient from 'react-native-linear-gradient';
import LottieView from 'lottie-react-native';
import Svg, { Circle } from 'react-native-svg';
import IIcon from 'react-native-vector-icons/Ionicons';
import MIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { _http_request, cacheStorage, help, logReport, parseCategoryProducts, screenWidth } from '../funcs/functions';
import { Loaderx } from '../funcs/functions_stateful';
import { namer, resourceMap, styles, __CONFIG__ } from '../funcs/static';
import { useTheme, ThemeColors } from '../funcs/theme';

const PLAN_UI: Record<string, { icon: string; color: string; cardColors: string[] }> = {
    plus: { icon: 'diamond-outline', color: '#111827', cardColors: ['#111827', '#374151'] },
    vip: { icon: 'crown-outline', color: '#92400e', cardColors: ['#f59e0b', '#b45309'] },
    free: { icon: 'account-heart-outline', color: '#64748b', cardColors: ['#334155', '#0f172a'] },
};

const getPlanUi = (plan?: string | null) => PLAN_UI[String(plan ?? '').trim().toLowerCase()] ?? PLAN_UI.free;

export function Screen_profile({ navigation }: { navigation: any }) {
    const { colors } = useTheme();
    const stylesx = useMemo(() => createStylesx(colors), [colors]);
    const [profile, setProfile] = useState<any>(null);
    const [mainSubProducts, setMainSubProducts] = useState<any[]>([]);

    const mapper = cacheStorage.CONFIG.get()?.mapper;
    const imageDomain = mapper?.img_domain?.[0] ?? mapper?.img_domain?.[2] ?? '';
    const consumableProducts: any[] = [];

    const profileCore = profile?.profile ?? {};
    const images = Array.isArray(profileCore?.images) ? profileCore.images : [];
    const userVerified = Boolean(profileCore?.verified ?? profile?.user_verified);
    const displayName = profileCore?.fullname ?? profile?.user_fullname ?? 'Your profile';
    const displayAge = help.getageFromDOB(profileCore?.dob ?? profile?.user_bio_dob ?? '');
    const firstImagePath = images?.[0]?.p ?? images?.[0]?.uri ?? '';
    const firstImageUri = firstImagePath ? (firstImagePath.startsWith('http') ? firstImagePath : `${imageDomain}${firstImagePath}`) : '';

    const subscriptionState = help.getSubscriptionState(profile);
    const activeSubscription = subscriptionState.hasActive;
    const subscriptionPlanUi = getPlanUi(subscriptionState.tier);
    const subscriptionCancelPending = Boolean(profile?.subscription?.cancel_at_period_end);
    const subscriptionRenewalDate = profile?.subscription?.end_date
        ? new Date(profile.subscription.end_date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
        : null;

    const refreshProfile = async () => {
        try {
            const freshProfile = await cacheStorage.getCurrentUserProfile(true);
            setProfile(freshProfile);
        } catch {
            // keep showing the last known profile if the refresh itself fails
        }
    };

    const confirmCancelSubscription = () => {
        const subscriptionId = profile?.subscription?.id;
        if (!subscriptionId) return;

        Alert.alert(
            'Cancel subscription',
            `Your ${subscriptionState.plan ?? 'subscription'} plan will stay active until ${subscriptionRenewalDate ?? 'the end of the current billing period'}, then it will not renew.`,
            [
                { text: 'Keep subscription', style: 'cancel' },
                {
                    text: 'Cancel subscription',
                    style: 'destructive',
                    onPress: async () => {
                        Loaderx.show();
                        const response: any = await _http_request({
                            customApiUrl: `${__CONFIG__.HTTPS_API_DOMAIN}/api/secure/gateway/cancel-subscription`,
                            reqType: 'POST',
                            bodyArray: { subscriptionId },
                        });
                        await refreshProfile();
                        Loaderx.hide();
                        if (response?.code === 200) {
                            Alert.alert('Subscription cancelled', 'You will keep access until the end of your current billing period.');
                        } else {
                            Alert.alert('Cancellation failed', response?.message ?? 'Please try again.');
                        }
                    },
                },
            ],
        );
    };

    const visibleMainSubProducts = useMemo(() => {
        if (subscriptionState.isVip) return [];
        if (subscriptionState.isPlus) {
            return mainSubProducts.filter((tier: any) => String(tier?.name ?? '').trim().toLowerCase() === 'vip');
        }
        return mainSubProducts;
    }, [mainSubProducts, subscriptionState.isPlus, subscriptionState.isVip]);

    const profileCompletion = useMemo(() => {
        const checkpoints = [
            String(profile?.user_bio_about ?? profileCore?.about ?? '').trim().length >= 3,
            images.length >= 3,
            (profile?.user_bio_prompt ?? []).length > 0,
        ];
        const score = checkpoints.filter(Boolean).length;
        return Math.round((score / checkpoints.length) * 100);
    }, [images.length, profile, profileCore?.about]);

    useFocusEffect(
        React.useCallback(() => {
            let mounted = true;

            (async () => {
                try {
                    const [products, freshProfile] = await Promise.all([
                        (async () => {
                            const raw = await cacheStorage.getProducts();
                            return parseCategoryProducts(raw, namer.productCategoryName.mainsub);
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
            headerStyle: { backgroundColor: colors.background },
            headerShadowVisible: false,
            headerTitle: '',
            headerRight:()=>  <Pressable style={stylesx.headerButton} onPress={() => navigation.navigate(namer.navigation.settings)}>
                    <MIcon name="cog-outline" size={25} color={colors.text} />
                </Pressable>
        });
    }, [navigation, colors, stylesx]);

    if (profile === null) {
        return (
            <View style={stylesx.loadingWrap}>
                <LottieView source={resourceMap.lottie.infinityLoading} autoPlay loop style={{ width: 220, height: 220 }} />
            </View>
        );
    }

    return (
        <View style={[styles.container, {paddingLeft:0,paddingRight:0, backgroundColor: colors.background }]}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.conainerScrollView,{gap:14, paddingBottom:10}]}>
                <View style={stylesx.profileCard}>
                    <View style={stylesx.profileRow}>
                        <Pressable onPress={() => navigation.navigate(namer.navigation.editprofile)}>
                            <View style={stylesx.avatarWrap}>
                                <CircularProgress progress={profileCompletion} color={colors.primary} trackColor={colors.border} styleProp={stylesx.progressCircle} />
                                {firstImageUri ? (
                                    <SafeImage
                                        style={stylesx.avatar}
                                        resizeMode="cover"
                                        source={{ uri: firstImageUri }}
                                        onError={() => logReport({ type: 'http -image', logMessage: 'Image load', url: firstImageUri, useraction: 'Image Load', stackTrace: null })}
                                    />
                                ) : (
                                    <View style={[stylesx.avatar, stylesx.avatarEmpty]}>
                                        <MIcon name="account-heart-outline" size={42} color={colors.primary} />
                                    </View>
                                )}
                                {userVerified && (
                                    <View style={stylesx.verifiedBadge}>
                                        <IIcon name="checkmark-done-circle-sharp" size={28} color={colors.accent} />
                                    </View>
                                )}
                            </View>
                        </Pressable>

                        <View style={stylesx.profileInfo}>
                            <Text style={stylesx.profileName} numberOfLines={1}>
                                {displayName}{displayAge ? `, ${displayAge}` : ''}
                            </Text>
                            <View style={stylesx.subscriptionBadge}>
                                <MIcon name={subscriptionPlanUi.icon} size={15} color={subscriptionPlanUi.color} />
                                <Text style={stylesx.subscriptionBadgeText}>
                                    {activeSubscription ? `${subscriptionState.plan} ${subscriptionState.variant ?? ''}`.trim() : 'Free plan'}
                                </Text>
                            </View>
                            <Text style={stylesx.completionText}>{profileCompletion}% profile complete</Text>
                        </View>
                    </View>

                    <View style={stylesx.actionRow}>
                        <ProfileAction icon="square-edit-outline" label="Edit Profile" onPress={() => navigation.navigate(namer.navigation.editprofile)} stylesx={stylesx} />
                        {!userVerified && (
                            <ProfileAction icon="camera-outline" label="Verify Account" secondary onPress={() => navigation.navigate(namer.navigation.editprofile)} stylesx={stylesx} />
                        )}
                    </View>
                </View>

                <View style={stylesx.card}>
                    <SectionHeader title="Power-ups" hint="Boost, spotlight, or message first." colors={colors} stylesx={stylesx} />
                    {consumableProducts.length > 0 ? (
                        <View style={stylesx.powerGrid}>
                            {consumableProducts.map((product: any, index: number) => (
                                <Pressable
                                    key={product?.sku ?? product?.name ?? index}
                                    style={stylesx.productPill}
                                    onPress={() => navigation.navigate(namer.navigation.consumables, { productcategory: namer.productCategoryName.superlike })}>
                                    <MIcon name={index % 2 === 0 ? 'heart' : 'chatbubble-ellipses'} size={22} color={colors.primary} />
                                    <View>
                                        <Text style={stylesx.productLabel}>{product?.name}</Text>
                                        <Text style={stylesx.productCount}>{product?.count ?? 0} available</Text>
                                    </View>
                                </Pressable>
                            ))}
                        </View>
                    ) : (
                        <Pressable
                            style={stylesx.powerEmpty}
                            onPress={() => navigation.navigate(namer.navigation.consumables, { productcategory: namer.productCategoryName.superlike })}>
                            <View style={stylesx.powerEmptyIcon}>
                                <MIcon name="star-four-points-outline" size={24} color={colors.primary} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={stylesx.powerEmptyTitle}>No power-ups active</Text>
                                <Text style={stylesx.powerEmptyText}>Open the shop to add one when you need a lift.</Text>
                            </View>
                            <MIcon name="chevron-right" size={24} color={colors.textTertiary} />
                        </Pressable>
                    )}
                </View>

                {activeSubscription && (
                    <View style={stylesx.card}>
                        <SectionHeader title="Manage subscription" icon="credit-card-outline" colors={colors} stylesx={stylesx} />
                        <View style={stylesx.manageSubRow}>
                            <Text style={stylesx.manageSubLabel}>Plan</Text>
                            <Text style={stylesx.manageSubValue}>
                                {`${subscriptionState.plan ?? ''} ${subscriptionState.variant ?? ''}`.trim() || 'Active'}
                            </Text>
                        </View>
                        <View style={stylesx.manageSubRow}>
                            <Text style={stylesx.manageSubLabel}>{subscriptionCancelPending ? 'Access ends' : 'Renews'}</Text>
                            <Text style={stylesx.manageSubValue}>{subscriptionRenewalDate ?? '—'}</Text>
                        </View>
                        {subscriptionCancelPending ? (
                            <View style={stylesx.manageSubNotice}>
                                <MIcon name="information-outline" size={16} color={colors.textSecondary} />
                                <Text style={stylesx.manageSubNoticeText}>
                                    This subscription will not renew and ends on the date above.
                                </Text>
                            </View>
                        ) : (
                            <Pressable style={stylesx.cancelSubButton} onPress={confirmCancelSubscription}>
                                <MIcon name="close-circle-outline" size={18} color={colors.danger} />
                                <Text style={stylesx.cancelSubButtonText}>Cancel subscription</Text>
                            </Pressable>
                        )}
                    </View>
                )}

                {visibleMainSubProducts.length > 0 && (
                    // show items
                    <View style={stylesx.planCardsWrapper}>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={[
                                stylesx.planCardsContent,
                                visibleMainSubProducts.length === 1 && stylesx.singlePlanCardsContent,
                            ]}
                            style={stylesx.planCardsScroll}
                        >
                            {visibleMainSubProducts.map((tier: any, index: number) => {
                            const tierName = String(tier?.name ?? '').trim();
                            const tierUi = getPlanUi(tierName);
                            const isCurrentTier = activeSubscription && subscriptionState.tier === tierName.toLowerCase();
                            const features = (tier?.description?.features ?? [])
                                .filter((feature: any) => feature?.e !== false && String(feature?.d ?? '').trim().length > 0)
                                .map((feature: any) => feature.d)
                                .slice(0, 4);

                            return (
                                <LinearGradient
                                    key={tier?.sku ?? index}
                                    colors={tierUi.cardColors}
                                    style={[stylesx.planCard, visibleMainSubProducts.length === 1 && stylesx.singlePlanCard]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}>
                                    <View style={stylesx.planHeader}>
                                        <Text style={stylesx.planTitle}>{tierName || 'Upgrade'}</Text>
                                        <MIcon name={tierUi.icon} size={22} color="#fff" />
                                    </View>

                                    <View style={stylesx.featuresList}>
                                        {features.length > 0 ? features.map((feature: string, featureIndex: number) => (
                                            <View key={`${feature}-${featureIndex}`} style={stylesx.featureItem}>
                                                <IIcon name="checkmark-circle" size={16} color="#fff" />
                                                <Text style={stylesx.featureText}>{feature}</Text>
                                            </View>
                                        )) : (
                                            <Text style={stylesx.featureText}>No features configured</Text>
                                        )}
                                    </View>

                                    <TouchableOpacity
                                        style={[stylesx.upgradeButton, isCurrentTier && stylesx.currentPlanButton]}
                                        disabled={isCurrentTier}
                                        onPress={() => navigation.navigate(namer.navigation.subscription, { tab: tier?.name })}>
                                        <Text style={stylesx.upgradeButtonText}>{isCurrentTier ? 'Current plan' : 'Upgrade'}</Text>
                                    </TouchableOpacity>
                                </LinearGradient>
                            );
                        })}
                    </ScrollView>
                    </View>
                )}

                {!activeSubscription && (
                    <View style={stylesx.card}>
                        <SectionHeader title="7 day streak" hint="Come back tomorrow to keep it going." icon="fire" colors={colors} stylesx={stylesx} />
                        <View style={stylesx.streakRow}>
                            {Array.from({ length: 7 }).map((_, index) => {
                                const isActive = index < (profile?.user_effect?.streakcount ?? 1);
                                return (
                                    <View key={index} style={[stylesx.streakDot, isActive && stylesx.streakDotActive]}>
                                        <MIcon name={index === 6 ? 'gift-outline' : 'fire'} size={index === 6 ? 21 : 23} color={isActive ? colors.premium : colors.textTertiary} />
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const CircularProgress = ({ size = 112, strokeWidth = 3, progress = 0, color, trackColor, styleProp }: { size?: number; strokeWidth?: number; progress?: number; color: string; trackColor: string; styleProp: any }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    return (
        <Svg width={size} height={size} style={styleProp}>
            <Circle stroke={trackColor} fill="none" cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} />
            <Circle stroke={color} fill="none" cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={strokeDashoffset} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        </Svg>
    );
};

const ProfileAction = ({ icon, label, secondary, onPress, stylesx }: { icon: string; label: string; secondary?: boolean; onPress: () => void; stylesx: any }) => (
    <Pressable style={[stylesx.profileAction, secondary && stylesx.profileActionSecondary]} onPress={onPress}>
        <MIcon name={icon} size={20} color={secondary ? '#7c3aed' : '#fff'} />
        <Text style={[stylesx.profileActionText, secondary && stylesx.profileActionTextSecondary]}>{label}</Text>
    </Pressable>
);

const SectionHeader = ({ title, hint, icon, colors, stylesx }: { title: string; hint?: string; icon?: string; colors: ThemeColors; stylesx: any }) => (
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
    headerButton: {
        width: 30,
        height: 30,
        borderRadius: 21,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surface,
        marginRight: 10,
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 14,
        elevation: 3,
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
    },
    completionText: {
        color: colors.textSecondary,
        fontSize: 13,
        fontWeight: '700',
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
        backgroundColor: '#f5f3ff',
        borderWidth: 1,
        borderColor: '#ddd6fe',
    },
    profileActionText: {
        color: '#fff',
        fontWeight: '900',
    },
    profileActionTextSecondary: {
        color: '#7c3aed',
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
        minWidth: 140,
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
        width: screenWidth * 0.8,
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
    manageSubRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 6,
    },
    manageSubLabel: {
        color: colors.textSecondary,
        fontSize: 13,
    },
    manageSubValue: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '700',
    },
    manageSubNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    manageSubNoticeText: {
        color: colors.textSecondary,
        fontSize: 12,
        flex: 1,
    },
    cancelSubButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 8,
        paddingTop: 12,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    cancelSubButtonText: {
        color: colors.danger,
        fontSize: 13,
        fontWeight: '700',
    },
    });
}
