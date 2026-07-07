import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import { View, Text, Pressable, Dimensions, StyleSheet, Animated, Easing, FlatList, ScrollView, Image, ActivityIndicator } from 'react-native';
import { _http_request, cacheStorage, help, hostServer, llStorage, logReport } from '../funcs/functions';
import { useFocusEffect } from '@react-navigation/native';
import { styles, namer, resourceMap } from '../funcs/static';
import IIcon from 'react-native-vector-icons/Ionicons';
import { BlurView } from '@react-native-community/blur';

import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useHeaderHeight } from '@react-navigation/elements';
import FastImage from 'react-native-fast-image';
import LottieView from 'lottie-react-native';

type LikesFilter = 'all' | 'verifiedOnly';

const likesFilters: { id: LikesFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'verifiedOnly', label: 'Verified only' },
];

const isVerifiedLike = (item: any) => {
    return item?.verified === true || item?.user_verified === 1 || item?.user_verified === '1' || item?.user_verfied === 1 || item?.user_verfied === '1';
};

const isSuperlike = (item: any) => {
    return item?.is_superlike === true || item?.match_status === 5 || item?.match_status === '5';
};

const getAllLikesSortPriority = (item: any) => {
    return (isVerifiedLike(item) ? 2 : 0) + (isSuperlike(item) ? 1 : 0);
};

export function Screen_likes({ navigation }: { navigation: any }) {
    const __MAPPER = llStorage.CONFIG.get()?.mapper;

    const [getProfile, setProfile] = useState<any>(null);
    const subscriptionState = help.getSubscriptionState(getProfile);
    const activeSubscription = subscriptionState.hasActive;
 
    const headerHeight = useHeaderHeight();
    const [getNewLikes, setNewLikes] = useState<any>(null);
    const [activeFilter, setActiveFilter] = useState<LikesFilter>('all');
    const [layout, setLayout] = useState({
        numColumns: 2,
        itemWidth: 0,
        itemHeight: 0
    });
    const LIKES_PAGE_SIZE = 12;
    const [visibleLikes, setVisibleLikes] = useState<number>(LIKES_PAGE_SIZE);
    const [isLoadingMore, setIsLoadingMore] = useState<boolean>(true);
    const totalLikesCount = useMemo(() => (getNewLikes?.length ?? 0), [getNewLikes]);
  


    // profile
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const [profile] = await Promise.all([cacheStorage.getCurrentUserProfile()]);
                if (mounted && profile) {
                    setProfile(profile);
                }
            } catch (error) {
                console.error("Error loading profile:", error);
                if (mounted) {
                    setProfile(null);
                }
            }
        })();

        return () => { mounted = false; };
    }, []);
    useLayoutEffect(() => {
        navigation.setOptions({
            headerTitleAlign: 'center',
            headerTitle: () => <View style={{ alignItems: "center", flexDirection: "row", gap: 5 }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', textTransform: "capitalize" }}>See who likes you</Text>
            </View>,
        });
    }, [activeSubscription]);





    // Calculate responsive layout based on orientation and device width
    const calculateLayout = useCallback((width: number, height: number) => {
        const isLandscape = width > height;
        const padding = 24;
        const gap = 12;

        let numColumns: number;
        if (isLandscape) {
            numColumns = width >= 900 ? 4 : 3;
        } else {
            numColumns = width >= 600 ? 3 : 2;
        }

        const itemWidth = (width - padding - (numColumns - 1) * gap) / numColumns;
        const itemHeight = itemWidth * 1.5;

        setLayout({ numColumns, itemWidth, itemHeight });
    }, []);

    const bounceAnimx = (new Animated.Value(0));
    const bounceInterpolatex = bounceAnimx.interpolate({
        inputRange: [0, 0.6, 1],
        outputRange: [0, -25, 0]
    });

    // Start bounce animation
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(bounceAnimx, {
                    toValue: 1,
                    duration: 800,
                    easing: Easing.out(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.timing(bounceAnimx, {
                    toValue: 0,
                    duration: 800,
                    easing: Easing.in(Easing.quad),
                    useNativeDriver: true,
                }),
            ]),
            { iterations: 2 }
        ).start();
    });

    // Initial layout calculation and on dimension change
    useEffect(() => {
        const { width, height } = Dimensions.get('window');
        calculateLayout(width, height);

        const subscription = Dimensions.addEventListener('change', ({ window }) => {
            calculateLayout(window.width, window.height);
        });

        return () => subscription?.remove();
    }, [calculateLayout]);

    const filteredLikes = useMemo(() => {
        let list = Array.isArray(getNewLikes) ? [...getNewLikes] : [];
        if (activeFilter === 'verifiedOnly') {
            list = list.filter(isVerifiedLike);
        } else {
            list = list
                .map((item: any, index: number) => ({ item, index }))
                .sort((a, b) => {
                    const priorityDiff = getAllLikesSortPriority(b.item) - getAllLikesSortPriority(a.item);
                    return priorityDiff || a.index - b.index;
                })
                .map(({ item }) => item);
        }
        return list;
    }, [activeFilter, getNewLikes]);

    const processedLikes = useMemo(() => {
        const maxItems = activeSubscription ? visibleLikes : 8;
        return filteredLikes.slice(0, maxItems);
    }, [activeSubscription, filteredLikes, visibleLikes]);

    const filteredLikesCount = filteredLikes.length;

    useEffect(() => {
        setVisibleLikes(LIKES_PAGE_SIZE);
        setIsLoadingMore(filteredLikesCount > LIKES_PAGE_SIZE);
    }, [activeFilter, filteredLikesCount]);

    const handleEndReached = useCallback(() => {
        if (!activeSubscription) {
            setIsLoadingMore(false);
            navigation.navigate(namer.navigation.subscription);
            return;
        }
        setTimeout(() => {
            if (visibleLikes >= filteredLikesCount){
                setIsLoadingMore(false);
                return;
            }
            setIsLoadingMore(true);
            setVisibleLikes((prev) => {
                if (prev >= filteredLikesCount) return prev;
                return Math.min(prev + LIKES_PAGE_SIZE, filteredLikesCount || prev + LIKES_PAGE_SIZE);
            });
        }, 1000);
    }, [activeFilter,activeSubscription, filteredLikesCount, navigation, visibleLikes]);


    // Fetch new likes when screen is focused
    useFocusEffect(React.useCallback(() => {
        _http_request({
            reqType: 'POST',
            customApiUrl: hostServer() + "/api/core/v1/getLikes",
        }).then((response: any) => {
            setTimeout(() => {
                setNewLikes((prev: any) => {
                    const incoming = response?.likedlist;
                    if (incoming === null || incoming === undefined || !Array.isArray(incoming)) {
                        return prev ?? [];
                    }
                    return incoming;
                });
            }, getNewLikes ? 0 : 1000);
        }).finally(() => { });
    }, []));

    if (getNewLikes === null) {
        return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }}><LottieView source={resourceMap.lottie.infinityLoading} autoPlay loop style={{ width: 220, height: 220 }} /></View>
    }

    return (
        <View style={[styles.container, { paddingTop: headerHeight }]}>

            <View style={styles.zcircle1} />
            <View style={styles.zcircle2} />
            <View style={styles.zcircle3} />
            {getNewLikes.length > 0 ? (
                <>
                    <FlatList key={`likesList-${layout.numColumns}`}
                        onEndReached={handleEndReached}
                        onEndReachedThreshold={0.1}
                        data={processedLikes}
                        keyExtractor={(item, index) => item?.likedUserId || index.toString()}
                        numColumns={layout.numColumns}
                        showsVerticalScrollIndicator={false}
                        columnWrapperStyle={{gap:7}}
                        ListHeaderComponent={<View style={{ gap: 12, marginBottom: 12 }}>
                            <View style={{ backgroundColor: '#0f172a', borderRadius: 16, padding: 14, overflow: 'hidden' }}>
                                <View style={styles.zcircle1} />
                                <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>You have {totalLikesCount} like{totalLikesCount > 1 ? "s" : ""}</Text>

                                <View style={{ marginTop: 10 }}>
                                    <Pressable onPress={() => navigation.navigate(namer.navigation.subscription)} style={{ flex: 1, backgroundColor: '#1d4ed8', borderRadius: 12, padding: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                        <MaterialCommunityIcons name="lightning-bolt-outline" size={18} color="#fff" />
                                        <Text style={{ color: '#fff', fontWeight: '700' }}>{activeSubscription ? 'Boost visibility' : 'Unlock all likes'}</Text>
                                    </Pressable>
                                </View>
                            </View>

                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                                {likesFilters.map((f) => {
                                    const active = activeFilter === f.id;
                                    return (
                                        <Pressable key={f.id} onPress={() => setActiveFilter(f.id)} style={{
                                            paddingHorizontal: 12,
                                            paddingVertical: 9,
                                            borderRadius: 16,
                                            borderWidth: 1,
                                            borderColor: active ? '#1d4ed8' : '#e5e7eb',
                                            backgroundColor: active ? '#e0e7ff' : '#f8fafc'
                                        }}>
                                            <Text style={{ color: active ? '#1d4ed8' : '#334155', fontWeight: '600', fontSize: 12 }}>{f.label}</Text>
                                        </Pressable>
                                    );
                                })}
                            </ScrollView>
                        </View>}
                        renderItem={({ item, index }) => (
                            <View style={{ flex:1 }}>
                                <Pressable style={[stylesoy.card, { width: '100%', height: layout.itemHeight, position: "relative" }]}
                                    onPress={() => {
                                        navigation.navigate(
                                            activeSubscription ? namer.navigation.peoplesOnePerson : namer.navigation.subscription, {
                                            getOnePersonId: item?.likedUserId,
                                            likedMatchedId: item?.likedMatchedId
                                        });
                                    }}>
                                    <View style={{ flex: 1, }}>
                                        <View style={{ flex: 1 }}>
                                            <FastImage style={stylesoy.image}
                                                source={{ cache: FastImage.cacheControl.immutable, uri: __MAPPER?.img_domain[0] + item?.likedUserImages?.p }}
                                                onError={() => { return logReport({ type: "http -image", logMessage: "Image load", url: __MAPPER?.img_domain[0] + (getProfile?.user_image?.[0]?.p ?? ""), useraction: 'Image Load', stackTrace: null }); }} />
                                            {!activeSubscription && <BlurView
                                                pointerEvents="none"
                                                style={StyleSheet.absoluteFill}
                                                blurType="light"
                                                blurAmount={15}
                                                reducedTransparencyFallbackColor="white"
                                            />}
                                        </View>
                                        <View style={stylesoy.topChips}>
                                            {isSuperlike(item) && (
                                                <View style={[stylesoy.pill, { backgroundColor: '#e11d48', opacity: 0.9 }]}>
                                                    <IIcon name="diamond" size={17} color="#fff" />
                                                    <Text style={[stylesoy.pillText, { color: '#fff' }]}>Super Like</Text>
                                                </View>
                                            )}
                                            {isVerifiedLike(item) && (
                                                <View style={[stylesoy.pill, { borderRadius: 15, paddingHorizontal: 3, paddingVertical: 3 }]}>
                                                    <IIcon name="checkmark-done-circle-sharp" size={20} color="rgb(100, 128, 254)" style={{ backgroundColor: "#fff", borderRadius: 15 }} />
                                                </View>
                                            )}
                                            {item?.distance && (
                                                <View style={stylesoy.pill}>
                                                    <IIcon name="location-outline" size={12} color="#fff" />
                                                    <Text style={stylesoy.pillText}>{item.distance} km</Text>
                                                </View>
                                            )}
                                        </View>
                                        <View style={stylesoy.infoContainer}>
                                            <Text style={stylesoy.name}>{item?.likedUserFullname[0] + '*'.repeat(Math.max(0, item?.likedUserFullname?.length - 1))},  {help.getageFromDOB(item?.likedUserDob)}</Text>
                                        </View>
                                    </View>
                                </Pressable>
                            </View>
                        )}
                        ListEmptyComponent={<View style={{ paddingVertical: 30, alignItems: 'center' }}>
                            <Text style={{ color: '#475569' }}>No likes match this filter.</Text>
                        </View>}
                        ListFooterComponent={isLoadingMore ? (
                            <View style={{ alignItems: 'center', paddingVertical: 12, width: '100%' }}>
                                <ActivityIndicator size="small" color="#1d4ed8" />
                                <Text style={{ marginTop: 6, color: '#475569', fontSize: 12 }}>Loading more likes...</Text>
                            </View>
                        ) : null}
                        // Optional performance optimizations:
                        initialNumToRender={10}
                        maxToRenderPerBatch={5}
                        windowSize={5}
                        removeClippedSubviews={false}
                    />

                    {!activeSubscription && <View style={{ position: "absolute", bottom: 24, left: 0, right: 0, alignItems: "center" }}>
                        <Animated.View style={{ transform: [{ translateY: bounceInterpolatex }] }}><Pressable
                            style={[styles.pressableButton, { flexDirection: "row", borderRadius: 20, alignItems: "center", justifyContent: "center", gap: 6 }]}
                            onPress={() => navigation.navigate(namer.navigation.subscription)}>
                            <MaterialCommunityIcons name="heart-outline" size={24} color="#fff" />

                            <Text style={styles.pressableButtonText}>See who likes you</Text>
                        </Pressable></Animated.View>
                    </View>}

                </>
            ) : (
                <View style={stylesoy.emptyState}>
                    <View style={stylesoy.emptyCard}>
                        <View style={stylesoy.emptyIconWrap}>
                            <MaterialCommunityIcons name="heart-outline" size={34} color="#db2777" />
                        </View>
                        <Text style={stylesoy.emptyText}>No new likes at the moment</Text>
                        <Text style={stylesoy.emptySubtext}>Keep your profile active and check back soon for new likes.</Text>
                        <Pressable style={stylesoy.emptyActionBtn} onPress={() => navigation.navigate(namer.navigation.peoples)}>
                            <Text style={stylesoy.emptyActionBtnText}>Discover people</Text>
                        </Pressable>
                    </View>
                </View>
            )}

        </View>
    );
}

const stylesoy = StyleSheet.create({


    card: {
        borderRadius: 8,
        backgroundColor: '#fff', marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
        overflow: 'hidden',
    },
    image: {
        width: '100%',
        height: '100%',
        backgroundColor: '#454545ff',
    },
    topChips: {
        position: 'absolute',
        top: 8,
        left: 8,
        right: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    pillText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '600',
    },
    infoContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: 10,
    },
    name: {
        fontSize: 14,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 4,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 18,
    },
    emptyCard: {
        width: '100%',
        maxWidth: 360,
        backgroundColor: '#fff',
        borderRadius: 22,
        paddingVertical: 24,
        paddingHorizontal: 18,
        alignItems: 'center',
        gap: 10,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.12,
        shadowRadius: 18,
        elevation: 9,
    },
    emptyIconWrap: {
        width: 62,
        height: 62,
        borderRadius: 31,
        backgroundColor: '#fce7f3',
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        fontSize: 21,
        fontWeight: '800',
        color: '#0f172a',
        textAlign: 'center',
    },
    emptySubtext: {
        fontSize: 14,
        color: '#475569',
        textAlign: 'center',
        lineHeight: 20,
    },
    emptyActionBtn: {
        marginTop: 4,
        backgroundColor: '#1d4ed8',
        paddingVertical: 11,
        paddingHorizontal: 16,
        borderRadius: 12,
    },
    emptyActionBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },
    cbsheet_press: {
        padding: 12,
    }
});
