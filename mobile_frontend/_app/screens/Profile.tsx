import React, { useLayoutEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import FastImage from 'react-native-fast-image';
import LinearGradient from 'react-native-linear-gradient';
import LottieView from 'lottie-react-native';
import Svg, { Circle } from 'react-native-svg';
import IIcon from 'react-native-vector-icons/Ionicons';
import MIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { cacheStorage, help, llStorage, logReport, parseCategoryProducts, screenWidth } from '../funcs/functions';
import { namer, resourceMap, styles } from '../funcs/static';

const PLAN_UI: Record<string, { icon: string; color: string; cardColors: string[] }> = {
    plus: { icon: 'diamond-outline', color: '#111827', cardColors: ['#111827', '#374151'] },
    vip: { icon: 'crown-outline', color: '#92400e', cardColors: ['#f59e0b', '#b45309'] },
    free: { icon: 'account-heart-outline', color: '#64748b', cardColors: ['#334155', '#0f172a'] },
};

const getPlanUi = (plan?: string | null) => PLAN_UI[String(plan ?? '').trim().toLowerCase()] ?? PLAN_UI.free;

export function Screen_profile({ navigation }: { navigation: any }) {
    const headerHeight = useHeaderHeight();
    const [profile, setProfile] = useState<any>(null);
    const [mainSubProducts, setMainSubProducts] = useState<any[]>([]);

    const mapper = llStorage.CONFIG.get()?.mapper;
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
            headerTransparent: true,
            headerTitle: '',
            headerRight:()=>  <Pressable style={stylesx.headerButton} onPress={() => navigation.navigate(namer.navigation.settings)}>
                    <MIcon name="cog-outline" size={25} color="#263238" />
                </Pressable>
        });
    }, [navigation]);

    if (profile === null) {
        return (
            <View style={stylesx.loadingWrap}>
                <LottieView source={resourceMap.lottie.infinityLoading} autoPlay loop style={{ width: 220, height: 220 }} />
            </View>
        );
    }

    return (
        <View style={[styles.container, {paddingTop: headerHeight,paddingLeft:0,paddingRight:0 }]}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.container,{gap:14, paddingBottom:10}]}>
                <View style={stylesx.profileCard}>
                    <View style={stylesx.profileRow}>
                        <Pressable onPress={() => navigation.navigate(namer.navigation.editprofile)}>
                            <View style={stylesx.avatarWrap}>
                                <CircularProgress progress={profileCompletion} />
                                {firstImageUri ? (
                                    <FastImage
                                        style={stylesx.avatar}
                                        resizeMode="cover"
                                        source={{ uri: firstImageUri }}
                                        onError={() => logReport({ type: 'http -image', logMessage: 'Image load', url: firstImageUri, useraction: 'Image Load', stackTrace: null })}
                                    />
                                ) : (
                                    <View style={[stylesx.avatar, stylesx.avatarEmpty]}>
                                        <MIcon name="account-heart-outline" size={42} color="#e8546f" />
                                    </View>
                                )}
                                {userVerified && (
                                    <View style={stylesx.verifiedBadge}>
                                        <IIcon name="checkmark-done-circle-sharp" size={28} color="#2563eb" />
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
                        <ProfileAction icon="square-edit-outline" label="Edit Profile" onPress={() => navigation.navigate(namer.navigation.editprofile)} />
                        {!userVerified && (
                            <ProfileAction icon="camera-outline" label="Verify Account" secondary onPress={() => navigation.navigate(namer.navigation.editprofile)} />
                        )}
                    </View>
                </View>

                <View style={stylesx.card}>
                    <SectionHeader title="Power-ups" hint="Boost, spotlight, or message first." />
                    {consumableProducts.length > 0 ? (
                        <View style={stylesx.powerGrid}>
                            {consumableProducts.map((product: any, index: number) => (
                                <Pressable
                                    key={product?.sku ?? product?.name ?? index}
                                    style={stylesx.productPill}
                                    onPress={() => navigation.navigate(namer.navigation.consumables, { productcategory: namer.productCategoryName.superlike })}>
                                    <MIcon name={index % 2 === 0 ? 'heart' : 'chatbubble-ellipses'} size={22} color="#e8546f" />
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
                                <MIcon name="star-four-points-outline" size={24} color="#e8546f" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={stylesx.powerEmptyTitle}>No power-ups active</Text>
                                <Text style={stylesx.powerEmptyText}>Open the shop to add one when you need a lift.</Text>
                            </View>
                            <MIcon name="chevron-right" size={24} color="#94a3b8" />
                        </Pressable>
                    )}
                </View>

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
                        <SectionHeader title="7 day streak" hint="Come back tomorrow to keep it going." icon="fire" />
                        <View style={stylesx.streakRow}>
                            {Array.from({ length: 7 }).map((_, index) => {
                                const isActive = index < (profile?.user_effect?.streakcount ?? 1);
                                return (
                                    <View key={index} style={[stylesx.streakDot, isActive && stylesx.streakDotActive]}>
                                        <MIcon name={index === 6 ? 'gift-outline' : 'fire'} size={index === 6 ? 21 : 23} color={isActive ? '#f59e0b' : '#94a3b8'} />
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

const CircularProgress = ({ size = 112, strokeWidth = 3, progress = 0, color = '#e8546f' }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    return (
        <Svg width={size} height={size} style={stylesx.progressCircle}>
            <Circle stroke="#e5e7eb" fill="none" cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} />
            <Circle stroke={color} fill="none" cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={strokeDashoffset} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        </Svg>
    );
};

const ProfileAction = ({ icon, label, secondary, onPress }: { icon: string; label: string; secondary?: boolean; onPress: () => void }) => (
    <Pressable style={[stylesx.profileAction, secondary && stylesx.profileActionSecondary]} onPress={onPress}>
        <MIcon name={icon} size={20} color={secondary ? '#7c3aed' : '#fff'} />
        <Text style={[stylesx.profileActionText, secondary && stylesx.profileActionTextSecondary]}>{label}</Text>
    </Pressable>
);

const SectionHeader = ({ title, hint, icon }: { title: string; hint?: string; icon?: string }) => (
    <View style={stylesx.sectionHeader}>
        {icon && (
            <View style={stylesx.sectionIcon}>
                <MIcon name={icon} size={20} color="#e8546f" />
            </View>
        )}
        <View style={{ flex: 1 }}>
            <Text style={stylesx.sectionTitle}>{title}</Text>
            {!!hint && <Text style={stylesx.sectionHint}>{hint}</Text>}
        </View>
    </View>
);

const stylesx = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    loadingWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
    },
    headerButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        marginRight: 10,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 14,
        elevation: 3,
    },
    
    profileCard: {
        borderRadius: 24,
        backgroundColor: '#fff',
        padding: 16,
        shadowColor: '#0f172a',
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
        backgroundColor: '#f1f5f9',
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
        backgroundColor: '#fff',
    },
    profileInfo: {
        flex: 1,
        gap: 8,
    },
    profileName: {
        color: '#0f172a',
        fontSize: 22,
        fontWeight: '900',
    },
    completionText: {
        color: '#64748b',
        fontSize: 13,
        fontWeight: '700',
    },
    subscriptionBadge: {
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#f8fafc',
        borderRadius: 999,
        paddingHorizontal: 11,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    subscriptionBadgeText: {
        color: '#475569',
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
        backgroundColor: '#e8546f',
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
        backgroundColor: '#fff',
        padding: 16,
        gap: 14,
        shadowColor: '#0f172a',
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
        backgroundColor: '#fff1f5',
    },
    sectionTitle: {
        color: '#0f172a',
        fontSize: 17,
        fontWeight: '900',
    },
    sectionHint: {
        color: '#64748b',
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
        backgroundColor: '#f8fafc',
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    productLabel: {
        color: '#0f172a',
        fontSize: 14,
        fontWeight: '900',
        textTransform: 'capitalize',
    },
    productCount: {
        color: '#64748b',
        fontSize: 12,
        fontWeight: '700',
        marginTop: 2,
    },
    powerEmpty: {
        minHeight: 76,
        borderRadius: 18,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
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
        backgroundColor: '#fff1f5',
    },
    powerEmptyTitle: {
        color: '#0f172a',
        fontSize: 14,
        fontWeight: '900',
    },
    powerEmptyText: {
        color: '#64748b',
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
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    streakDotActive: {
        backgroundColor: '#fffbeb',
        borderColor: '#fde68a',
    },
});
