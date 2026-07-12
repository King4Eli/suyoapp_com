import React, { useState, useRef, useLayoutEffect, useEffect, useMemo } from 'react';
import IIcon from 'react-native-vector-icons/Ionicons';
import MIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { View, Text, Pressable, ScrollView, Alert, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Loaderx, bottomsheet_renderBackdrop } from '../funcs/functions_stateful';
import { useFocusEffect } from '@react-navigation/native';
import { styles, namer, colors, resourceMap } from '../funcs/static';
import { _http_request, cacheStorage,    help, hostServer, logReport, screenHeight, sleep } from '../funcs/functions';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { TextInput } from 'react-native-gesture-handler';
import { LinearGradient } from 'react-native-linear-gradient';
import { Toastx } from '../funcs/customNotification';
import FastImage from 'react-native-fast-image';
import LottieView from 'lottie-react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { CarouselRef, ControlledCarousel } from '../funcs/customCarousel';
import ImageViewing from 'react-native-image-viewing';
import { ActionBurstKind, ActionBurstOverlay, ConfettiBurst } from '../funcs/customCelebration';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';


export default function Peoples_Screen({ route, navigation }: { route: any, navigation: any }) {
    const [getProfile, setProfile] = useState<any>(null);

    const __MAPPER = cacheStorage.CONFIG.get()?.mapper;
    const imageDomain = __MAPPER?.img_domain?.[0] ?? null;
 
    const [getPeopleToMatch, setPeopleToMatch] = useState<any[] | null>(null);
    const [gptmd, sptmd] = useState<boolean>(false);
    const scrollViewRef = useRef<ScrollView>(null);
    const headerHeight = useHeaderHeight();
    const [getSkippedLastPerson, setSkippedLastPerson] = useState<any|null>(null);
    const [photoIndex, setPhotoIndex] = useState(0);
    const [getFullscreenClickImageIndex, setFullscreenClickImageIndex] = useState<number | null>(null);
    const [showItsAMatchModal, setShowItsAMatchModal] = useState(false);
    const [getShowDislikedMatchModal, setShowDislikedMatchModal] = useState(false);
    const [getActionBurst, setActionBurst] = useState<{ kind: ActionBurstKind; key: number } | null>(null);

    const carouselRef = useRef<CarouselRef>(null);
    const insets = useSafeAreaInsets(); 

    // "it's a match!" entrance animation
    const matchScale = useSharedValue(0.6);
    const matchOpacity = useSharedValue(0);
    const leftPhotoX = useSharedValue(-90);
    const rightPhotoX = useSharedValue(90);
    useEffect(() => {
        if (showItsAMatchModal) {
            matchScale.value = 0.6;
            matchOpacity.value = 0;
            leftPhotoX.value = -90;
            rightPhotoX.value = 90;
            matchOpacity.value = withTiming(1, { duration: 200 });
            matchScale.value = withSpring(1, { damping: 11, stiffness: 160 });
            leftPhotoX.value = withDelay(120, withSpring(0, { damping: 12, stiffness: 140 }));
            rightPhotoX.value = withDelay(180, withSpring(0, { damping: 12, stiffness: 140 }));
        }
    }, [showItsAMatchModal]);
    const matchCardAnimStyle = useAnimatedStyle(() => ({
        opacity: matchOpacity.value,
        transform: [{ scale: matchScale.value }],
    }));
    const leftPhotoAnimStyle = useAnimatedStyle(() => ({ transform: [{ translateX: leftPhotoX.value }, { rotate: '-12deg' }] }));
    const rightPhotoAnimStyle = useAnimatedStyle(() => ({ transform: [{ translateX: rightPhotoX.value }, { rotate: '12deg' }] }));

    // "you passed but it was a match" shake animation
    const passedShakeX = useSharedValue(0);
    useEffect(() => {
        if (getShowDislikedMatchModal) {
            passedShakeX.value = 0;
            passedShakeX.value = withDelay(80, withSequence(
                withTiming(-10, { duration: 60, easing: Easing.linear }),
                withTiming(10, { duration: 100, easing: Easing.linear }),
                withTiming(-6, { duration: 100, easing: Easing.linear }),
                withTiming(0, { duration: 80, easing: Easing.linear }),
            ));
        }
    }, [getShowDislikedMatchModal]);
    const passedShakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: passedShakeX.value }] }));
    const currentPerson = getPeopleToMatch?.[0] ?? [];
    const nextPerson = getPeopleToMatch?.[1] ?? [];
    const currentUserImages = (currentPerson?.user_image ?? []);
    const currentPhotos = currentUserImages.filter((img: any) => img?.p);
    const prompts = [currentPerson?.user_bio_prompt?.[0], currentPerson?.user_bio_prompt?.[1], currentPerson?.user_bio_prompt?.[2],].filter(Boolean);

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


 
    const bottomSheetRef_reportUser = {
        ref: useRef<BottomSheet>(null),
        snap: useMemo(() => ['80%'], [])
    }; 

    const functs = {
        onePersonProfile: route?.params?.getOnePersonId, //str
        isAlreadyLiked: route?.params?.alreadyLiked || false, //bool
        previewP: route?.params?.previewProfile || false,
        likedMatchId: route?.params?.likedMatchedId,//str
        refreshPeoples: () => {
            const j = getPeopleToMatch?.filter((v: any) => v.user_id !== getPeopleToMatch?.[0]?.user_id);
            // console.log("remove last---", getPeopleToMatch?.length, j?.length)
            setPeopleToMatch(j ?? null);
        }
    }


    // header options
    useLayoutEffect(() => {
        navigation.setOptions({
            headerShown: true,
            headerTransparent: true,
            headerTitleAlign: 'left',
            headerTitle: () => <View style={{ paddingVertical: 6, }}>
                <View style={{ alignItems: "center", flexDirection: "row", gap: 2 }}>
                    {getPeopleToMatch?.[0]?.user_verified === 1 && <IIcon name="checkmark-done-circle-sharp" size={20} color="#4F8EF7" />}
                    <Text style={{ fontSize: 20, fontWeight: 'bold', textTransform: "capitalize" }}>{(getPeopleToMatch?.[0]?.user_fullname ?? "") + (getPeopleToMatch?.[0]?.user_bio_dob ? ", " + help.getageFromDOB(getPeopleToMatch?.[0]?.user_bio_dob) : "")}</Text>
                </View>
            </View>,

            headerRight: () => !functs.onePersonProfile && (
                <View style={[{ paddingRight: 10, flexDirection: "row", gap: 14, alignItems: "center" },
                    {
                        padding: 6,
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
                    }
                ]}>
                    {getSkippedLastPerson !== null && <Pressable style={{ gap: 3 }} onPress={() => {
                        setPeopleToMatch((prev) => [getSkippedLastPerson, ...(prev ?? [])]);
                        setSkippedLastPerson(null);
                    }}>
                        <MIcon name="backup-restore" size={30} color="#204586ff" />
                    </Pressable>}
                    <Pressable style={{ gap: 3 }} onPress={() => { navigation.navigate(namer.navigation.editpreference); }}>
                        <IIcon name="filter-outline" size={30} color="#204586ff" />
                    </Pressable>
                </View>),
        });
    }, [getPeopleToMatch, getSkippedLastPerson]);

    // next person load images
    useEffect(() => {
        if (nextPerson?.user_image?.length > 1) {
            nextPerson?.user_image.forEach((url: any) => {
                const imgh = imageDomain + url?.p;
                //console.log("preloading next image:", imgh);
                if (imageDomain !== null) FastImage.preload([{ uri: imgh }]);

            });
        }
    }, [getPeopleToMatch]);

    // reset photo index on new person
    useEffect(() => {
        setPhotoIndex(0);
        carouselRef.current?.goToPage(0);
    }, [getPeopleToMatch?.[0]?.user_id]);

    // load peoples to match on focus
    useFocusEffect(React.useCallback(() => {
        _http_request({
            reqType: 'POST',
            customApiUrl: hostServer() + "/api/core/v1/getPeopleToMatch",
            bodyArray: {
                getOnePersons_id2: functs.onePersonProfile
            }
        }).then((response) => {
            if (response?.code === 200) {
                let peopleMatchArr = response?.matchespeoples ?? [];
                //console.log("new peoples reloaded total, now:", peopleMatchArr.length);
                setPeopleToMatch(peopleMatchArr);
            } else if (response?.code === 404) {
                setPeopleToMatch([]);
            }
        }).finally(() => {
            scrollViewRef.current?.scrollTo({ y: 0, animated: true });// Scroll to the top of the scroll view after action
        });

    }, [gptmd]));


    const ReportContent = () => {
        const [selectedReason, setSelectedReason] = useState('');
        const [otherText, setOtherText] = useState('');
        const styless = StyleSheet.create({
            radioRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
            radioOuter: {
                width: 22,
                height: 22,
                borderRadius: 11,
                borderWidth: 2,
                borderColor: '#999',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 10,
            },
            radioOuterSelected: { borderColor: '#ff3366' },
            radioInner: {
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: '#ff3366',
            },
            radioText: { fontSize: 16, color: '#333' },

        });

        const reasons = [
            'Inappropriate Profile Content',
            'Harassment or Hate Speech',
            'Fake profile or Impersonation',
            'Spam or Scam',
            'Underage User/Content',
            'Promoting, Selling or Soliciting',
            'Violence or Harmful Behavior',
            'Privacy Violation',
            'Suspicious Behavior',
            'Other'
        ];
        const reportedUserName = getPeopleToMatch?.[0]?.user_fullname;
        const scrollRef = useRef<ScrollView>(null);

        return (
            <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} style={{ flex: 1 }}  >
                <View style={[styles.container, { paddingBottom: 5 }]}>
                    <Text style={styles.title}>Report {reportedUserName}</Text>
                    <Text style={[styles.subtitle, { marginBottom: 12, textAlign: "center" }]}>Select a reason</Text>
                    {reasons.map((reason, index) => (<TouchableOpacity key={index} style={styless.radioRow} onPress={() => { setSelectedReason(reason); scrollRef.current?.scrollToEnd({ animated: true }); }} >
                        <View style={[styless.radioOuter, selectedReason === reason && styless.radioOuterSelected]}>{selectedReason === reason && <View style={styless.radioInner} />}</View>
                        <Text style={styless.radioText}>{reason}</Text>
                    </TouchableOpacity>))}

                    {selectedReason === 'Other' && (<View style={{ marginBottom: 12 }}>
                        <TextInput style={[styles.input, { height: 120, textAlignVertical: 'top', marginBottom: 0 }]} placeholder="Please specify" value={otherText} onChangeText={setOtherText} multiline maxLength={300} />
                        <Text style={{ fontSize: 11, color: '#909090', textAlign: 'right' }}>{otherText.length} / 300</Text>
                    </View>)}

                    <TouchableOpacity style={[styles.pressableButton, { marginTop: 15 }]} onPress={() => {
                        const finalReason = selectedReason === 'Other' ? otherText : selectedReason;
                        if (finalReason) {
                            Loaderx.show();
                            logReport({
                                type: "reportuser",
                                useraction: "snitch",
                                logMessage: finalReason,
                                reporteduserId: getPeopleToMatch?.[0]?.user_id
                            });
                            //then 
                            peoples_action("report", 4).then(() => {

                                bottomSheetRef_reportUser.ref.current?.close();
                                Toastx.show({
                                    type: "success",
                                    message: reportedUserName + " has been reported!"
                                });
                                Loaderx.hide();
                                scrollViewRef.current?.scrollTo({ y: 0, animated: true });
                            });

                        } else {
                            Toastx.show({ type: 'info', message: 'Please select a reason to report.' });
                        }
                    }}>
                        <Text style={styles.pressableButtonText}>Submit Report</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>);
    }


    // people action like, dislike, superlike, block, report
    async function peoples_action(
        what: "like" | "superlike" | "dislike" | "block" | "report",
        matchStatus: number = 0,
        showloader: boolean = true) {
        try {
            showloader && Loaderx.show();
            switch (what) {
                case 'like':
                case 'superlike':
                case 'dislike':
                case 'report':
                case 'block':
                    const matchId = getPeopleToMatch?.[0]?.match_id || functs.likedMatchId;
                    await _http_request({
                        reqType: 'POST',
                        customApiUrl: hostServer() + "/api/core/v1/pushPeopleToMatch",
                        bodyArray: {
                            user_id2: getPeopleToMatch?.[0]?.user_id,
                            match_status: matchStatus,
                            matchId: matchId
                        }
                    }).then((response) => {
                        if (what === "dislike") {
                            if (functs.onePersonProfile) {
                                navigation.popToTop();
                                return;
                            } else {
                                setSkippedLastPerson(getPeopleToMatch?.[0] ?? {});
                            }
                            // and its a match
                            if (matchId) {
                                setShowDislikedMatchModal(true);
                                return;
                            }
                        }
                        // if its a match
                        if (response?.itisamatch) {
                            setShowItsAMatchModal(true);
                            return;
                        }

                        // 
                        if ((getPeopleToMatch?.length ?? 0) <= 2 && !functs.onePersonProfile) {// Refresh the people to match list if there are only 2 or fewer left after the action
                            setPeopleToMatch(null);
                            sptmd((prev: boolean) => !prev);
                            console.log("refresh from server...");
                        }

                        if (!functs.onePersonProfile) {
                            // if not from a match
                            functs.refreshPeoples();
                        }

                    }).finally(() => {
                        scrollViewRef.current?.scrollTo({ y: 0, animated: true });// Scroll to the top of the scroll view after action
                    });
                    break;
                case 'report':
                    logReport({ type: "reportuser", useraction: "reporting user", logMessage: "Reason: ", reporteduserId: getPeopleToMatch?.[0]?.user_id });
                    break;
            }
        } catch (e: any) {
            Toastx.show({ type: 'info', message: 'Error processing request' });
            logReport({
                type: "function",
                extra: "Error in peoples_action",
                useraction: "initailizing app",
                logMessage: e.message,
                stackTrace: e
            });
        } finally {
            setTimeout(() => {
                Loaderx.hide();
            }, 765);
        }
    }




    const distanceLabel = (() => {
        const miles = Number(currentPerson?.distance_miles);
        if (!Number.isFinite(miles)) return null;
        return miles < 1 ? "Less than a mile away" : `${Math.round(miles)} mi away`;
    })();

    const languagesSpoken: string[] = (() => {
        const raw = currentPerson?.user_bio_language;
        if (Array.isArray(raw)) return raw;
        if (typeof raw === 'string' && raw) {
            try {
                const parsed = JSON.parse(raw);
                return Array.isArray(parsed) ? parsed : [];
            } catch { return []; }
        }
        return [];
    })();

    const highlightFields = !currentPerson ? [] : [
        { icon: <IIcon name="navigate-outline" size={18} color="#0ea5e9" />, value: distanceLabel },
        { icon: <IIcon name="location-outline" size={18} color="#0ea5e9" />, value: currentPerson?.user_location?.city },
        { icon: <MIcon name="ruler" size={18} color="#0ea5e9" />, value: currentPerson?.user_bio_height ? help.cmToFtIn(currentPerson?.user_bio_height) : null },
        { icon: <IIcon name="heart-circle-outline" size={18} color="#0ea5e9" />, value: __MAPPER?.bio_intent?.[currentPerson?.user_bio_relationshipgoal] },
        { icon: <MIcon name="flag-outline" size={18} color="#0ea5e9" />, value: currentPerson?.user_bio_ethnicity },
    ].filter((item) => item.value);

    const detailFields = !currentPerson ? [] : [
        { icon: <IIcon name="ribbon-outline" size={22} color="#0ea5e9" />, value: __MAPPER?.bio_education?.[currentPerson?.user_bio_highesteducation] },
        { icon: <IIcon name="language-outline" size={22} color="#0ea5e9" />, value: languagesSpoken.length > 0 ? languagesSpoken.join(', ') : null },
        { icon: <MIcon name="candle" size={22} color="#0ea5e9" />, value: __MAPPER?.bio_religion?.[currentPerson?.user_bio_religion] },
        { icon: <MIcon name="baby-carriage" size={22} color="#0ea5e9" />, value: __MAPPER?.bio_children?.[currentPerson?.user_bio_children] },
        { icon: <IIcon name="wine-outline" size={22} color="#0ea5e9" />, value: __MAPPER?.bio_drinking?.[currentPerson?.user_bio_drinking] },
        { icon: <MIcon name="smoking" size={22} color="#0ea5e9" />, value: __MAPPER?.bio_smoking?.[currentPerson?.user_bio_smoking] },
        { icon: <IIcon name="transgender-outline" size={22} color="#fe6fa6" />, value: __MAPPER?.bio_gender?.[currentPerson?.user_bio_gender] },
        { icon: <MIcon name="gavel" size={22} color="#0ea5e9" />, value: __MAPPER?.bio_politicalview?.[currentPerson?.user_bio_politicalview] },
        { icon: <MIcon name="dog-side" size={18} color="#0ea5e9" />, value: __MAPPER?.bio_pets?.[currentPerson?.user_bio_haspet] },
    ].filter((item) => item.value);

    const writableFields = !currentPerson ? [] : [
        { icon: <MIcon name="briefcase-variant-outline" size={22} color="#0ea5e9" />, value: (currentPerson?.user_bio_jobrole) },
        { icon: <MIcon name="home-outline" size={22} color="#0ea5e9" />, value: currentPerson?.user_bio_hometown },
        { icon: <MIcon name="school-outline" size={22} color="#0ea5e9" />, value: currentPerson?.user_bio_schoolattended },
    ].filter((item) => item.value);

    if (getPeopleToMatch === null) {
        return <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><LottieView
            source={resourceMap.lottie.pulsingLoading}
            autoPlay
            loop
            style={{ width: 220, height: 220 }}
        /></View>
    }


    return (
        <><View style={[styles.container, { paddingHorizontal: 0, paddingTop: headerHeight }]}>

            {getPeopleToMatch?.length === 0 ? (
                <View style={deckStyles.emptyStateWrap}>
                    <View style={[deckStyles.emptyStateCard, deckStyles.cardShadow]}>
                        <View style={deckStyles.emptyStateIconWrap}>
                            <IIcon name="people-outline" size={34} color="#0284c7" />
                        </View>
                        <Text style={deckStyles.emptyStateTitle}>No more profiles to show.</Text>
                        <Text style={deckStyles.emptyStateSubtitle}>
                            You have seen everyone nearby for now. Refresh or adjust your preferences to discover more people.
                        </Text>
                        <View style={deckStyles.emptyStateActions}>
                            <Pressable style={[styles.pressableButton, deckStyles.emptyStatePrimaryAction]} onPress={() => {
                                setPeopleToMatch(null);
                                sptmd((prev: boolean) => !prev);
                            }}>
                                <Text style={styles.pressableButtonText}>Refresh suggestions</Text>
                            </Pressable>
                            <Pressable style={deckStyles.emptyStateSecondaryAction} onPress={() => { navigation.push(namer.navigation.editpreference); }}>
                                <Text style={deckStyles.emptyStateSecondaryActionText}>Update preferences</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            ) : (
                <SafeAreaView style={{ flex: 1 }} edges={functs.onePersonProfile ? ['bottom'] : []}>
                    <ScrollView ref={scrollViewRef} showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} horizontal={false}
                        contentContainerStyle={[styles.conainerScrollView, { paddingBottom: functs.isAlreadyLiked ? 20 : 100 }]}>

                        <View style={[{ borderRadius: 20, overflow: 'hidden', backgroundColor: '#0f172a' }, deckStyles.cardShadow]}>

                            {currentPhotos.length > 1 && (
                                <View style={[deckStyles.progressDots, { zIndex: 123 }]}>
                                    {currentPhotos.map((_: any, dotIdx: number) => (
                                        <View key={dotIdx} style={[deckStyles.dot, dotIdx === photoIndex ? deckStyles.dotActive : null]} />
                                    ))}
                                </View>
                            )}

                            <ControlledCarousel ref={carouselRef} onPageChange={setPhotoIndex}
                                pages={(currentPhotos.length > 0 ? currentPhotos : [null]).map((photo: any, idx: number) => (
                                    <View key={`photo-${idx}`} style={{ width: '100%', height: (screenHeight * .94) - headerHeight - insets.bottom }}>
                                        {photo && (<FastImage source={{ uri: imageDomain + (photo?.p ?? "") }}
                                            onError={() => { return logReport({ type: "http -image", logMessage: "Image load", url: imageDomain + (photo?.p ?? ""), useraction: 'Image Load', stackTrace: null }); }}
                                            style={StyleSheet.absoluteFill} resizeMode={FastImage.resizeMode.cover} />)}

                                        <LinearGradient colors={['rgba(0, 0, 0, 0.35)', 'rgba(0, 0, 0, 0)']}
                                            start={{ x: 0.5, y: 1 }} end={{ x: 0.5, y: 0 }}
                                            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '40%' }} />
                                        <View style={deckStyles.tapZones}>
                                            <Pressable style={deckStyles.tapZone} onPress={() => carouselRef.current?.goToPrevious()} />
                                            <Pressable style={deckStyles.tapZone} onPress={() => carouselRef.current?.goToNext()} />
                                        </View>
                                    </View>
                                ))} />

                            <View style={deckStyles.cardFooter}>
                                <View style={deckStyles.nameRow}>
                                    <Text style={deckStyles.name}>{currentPerson?.user_fullname}{currentPerson?.user_bio_dob ? ", " + help.getageFromDOB(currentPerson?.user_bio_dob) : ""}</Text>
                                    {currentPerson?.user_verified === 1 && <IIcon name="checkmark-done-circle-sharp" size={22} color="#38bdf8" />}
                                </View>
                                <View style={deckStyles.chipRow}>
                                    {highlightFields.map((field, chipIdx) => (
                                        <View key={chipIdx} style={deckStyles.chip}>
                                            {field.icon}
                                            <Text style={deckStyles.chipText}>{field.value}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        </View>


                        <View style={[deckStyles.detailCard, deckStyles.cardShadow]}>
                            <Text style={deckStyles.sectionTitle}>About {currentPerson?.user_fullname?.split(" ")?.[0] || "them"}</Text>
                            {currentPerson?.user_bio_about && <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 20 }}>{currentPerson?.user_bio_about}</Text>}
                            {detailFields.length > 0 && (
                                <View style={deckStyles.detailGrid}>
                                    {detailFields.map((field, idx) => (
                                        <View key={idx} style={deckStyles.detailItem}>
                                            {field.icon}
                                            <Text style={[deckStyles.detailText, { textTransform: "capitalize", paddingRight: 1 }]}>{field.value}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
                        {writableFields.length > 0 && (
                            <View style={[deckStyles.detailCard, deckStyles.cardShadow]}>
                                <Text style={deckStyles.sectionTitle}>More about {currentPerson?.user_fullname?.split(" ")?.[0] || "them"}</Text>
                                <View style={[deckStyles.detailGrid, { flexWrap: 'nowrap', flexDirection: 'column' }]}>
                                    {writableFields.map((field, idx) => (
                                        <View key={idx} style={deckStyles.detailItem}>
                                            {field.icon}
                                            <Text style={deckStyles.detailText}>{field.value}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}


                        {currentUserImages.length > 0 && (
                            <View style={[deckStyles.detailCard, deckStyles.cardShadow]}>
                                <Text style={deckStyles.sectionTitle}>Photos</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                                    {currentUserImages.map((img: any, idx: number) => (
                                        <Pressable key={idx} onPress={() => setFullscreenClickImageIndex(idx)}>
                                            <FastImage source={{ uri: imageDomain + img.p }} style={deckStyles.galleryImage} resizeMode="cover"
                                                onError={() => { return logReport({ type: "http -image", logMessage: "Image load", url: imageDomain + (img?.p ?? ""), useraction: 'Image Load', stackTrace: null }); }} />
                                        </Pressable>
                                    ))}
                                </ScrollView>
                            </View>
                        )}

                        {prompts.map((prompt: any, idx: number) => (
                            prompt?.question && prompt?.answer && (
                                <LinearGradient key={idx} colors={PROMPT_GRADIENTS[idx % PROMPT_GRADIENTS.length]}
                                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                    style={[deckStyles.promptCard, deckStyles.cardShadow]}>
                                    <MIcon name="format-quote-close" size={72} color="rgba(255,255,255,0.07)" style={deckStyles.promptQuoteDeco} />
                                    <View style={deckStyles.promptTag}>
                                        <Text style={deckStyles.promptTagText}>{prompt?.question}</Text>
                                    </View>
                                    <Text style={deckStyles.promptAnswer}>{prompt?.answer}</Text>
                                    {!functs.isAlreadyLiked && (
                                        <Pressable style={deckStyles.promptLikeBtn} onPress={() => {
                                            setActionBurst({ kind: 'like', key: Date.now() });
                                            peoples_action('like', 0, false);
                                        }}>
                                            <IIcon name="heart" size={18} color="#fff" />
                                        </Pressable>
                                    )}
                                </LinearGradient>
                            )
                        ))}

                        {!functs.previewP && (
                            <View style={[deckStyles.detailCard, deckStyles.cardShadow]}>
                                <Text style={deckStyles.sectionTitle}>Safety</Text>
                                <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                                    <Pressable style={[styles.pressableButton, { backgroundColor: colors.warning, flex: 1 }]} onPress={() => {
                                        bottomSheetRef_reportUser.ref.current?.expand();
                                    }}>
                                        <Text style={styles.pressableButtonText}>Report</Text>
                                    </Pressable>
                                    <Pressable style={[styles.pressableButton, { flex: 1, backgroundColor: colors.error }]} onPress={async () => {
                                        function showConfirmAlert() {
                                            return new Promise((resolve) => {
                                                Alert.alert(
                                                    "Block this person?",
                                                    "Blocking this person prevents them from ever seeing your profile or message you!",
                                                    [
                                                        { text: "No", onPress: () => { resolve(false); }, style: "cancel", },
                                                        { text: "Block", onPress: () => { resolve(true); }, },
                                                    ],
                                                    { cancelable: false }
                                                );
                                            });
                                        }
                                        if (await showConfirmAlert() === false) { return; } else {
                                            peoples_action("block", 3).then(() => {
                                                if (functs.onePersonProfile) {
                                                    navigation.popToTop();
                                                } else {
                                                    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
                                                }
                                            });
                                        }
                                    }}>
                                        <Text style={styles.pressableButtonText}>Block</Text>
                                    </Pressable>
                                </View>
                            </View>
                        )}
                    </ScrollView>

                    {!functs.isAlreadyLiked && (
                        <View style={[deckStyles.actionDock, functs.onePersonProfile ? { paddingBottom: 30 } : {}]}>
                            <Pressable style={[deckStyles.circleBtn, deckStyles.circleBtnGhost]} onPress={() => {
                                setActionBurst({ kind: 'dislike', key: Date.now() });
                                peoples_action('dislike', 2,false);
                            }}>
                                <IIcon name="close" size={30} color="#f43f5e" />
                            </Pressable>
                            {!functs.onePersonProfile && <Pressable style={[deckStyles.circleBtn, deckStyles.circleBtnAccent]} onPress={() => {
                                setActionBurst({ kind: 'superlike', key: Date.now() });
                                peoples_action('superlike', getPeopleToMatch?.[0]?.match_id ? 1 : 5, false);
                            }}>
                                <IIcon name="diamond" size={30} color="#0ea5e9" />
                            </Pressable>}
                            <Pressable style={[deckStyles.circleBtn, deckStyles.circleBtnPrimary]} onPress={() => {
                                 setActionBurst({ kind: 'like', key: Date.now() });
                                peoples_action('like', 0, false);
                            }}>
                                <IIcon name="heart" size={30} color="#22c55e" />
                            </Pressable>
                        </View>
                    )}
                </SafeAreaView>
            )}







            {/* ITS a matCH */}
            <Modal visible={showItsAMatchModal} transparent animationType="fade"
                onRequestClose={() => {
                    setShowItsAMatchModal(false);
                    if (functs.onePersonProfile) {
                        navigation.popToTop();
                    }
                }} >
                <View style={matchStyles.backdrop}>
                    <ConfettiBurst trigger={showItsAMatchModal} />
                    <Animated.View style={[matchStyles.card, matchCardAnimStyle]}>
                        <View style={styles.zcircle1} />
                        <View style={styles.zcircle2} />
                        <View style={styles.zcircle3} />

                        <Text style={matchStyles.title}>It's a match! 🎉</Text>
                        <Text style={matchStyles.subtitle}>You and {getPeopleToMatch?.[0]?.user_fullname || "them"} like each other</Text>

                        <View style={matchStyles.photoRow}>
                            <Animated.View style={[matchStyles.photoCard, matchStyles.leftPhoto, leftPhotoAnimStyle]}>
                                <FastImage source={{ uri: String(imageDomain + (getProfile?.profile?.images?.[0]?.p ?? "")) }} style={{ width: '100%', height: '100%' }} resizeMode="cover"
                                    onError={() => { return logReport({ type: "http -image", logMessage: "Image load", url: imageDomain + (getProfile?.profile?.images?.[0]?.p ?? ""), useraction: 'Image Load', stackTrace: null }); }} />

                            </Animated.View>
                            <Animated.View style={[matchStyles.photoCard, matchStyles.rightPhoto, rightPhotoAnimStyle]}>
                                <FastImage source={{ uri: String(imageDomain + (currentUserImages?.[0]?.p ?? "")) }} style={{ width: '100%', height: '100%' }} resizeMode="cover"
                                    onError={() => { return logReport({ type: "http -image", logMessage: "Image load", url: imageDomain + (currentUserImages?.[0]?.p ?? ""), useraction: 'Image Load', stackTrace: null }); }} />

                            </Animated.View>
                        </View>

                        <Pressable style={matchStyles.primaryBtn} onPress={() => {
                            if (functs.onePersonProfile) {
                                navigation.popToTop();
                            }
                            const matchId = getPeopleToMatch?.[0]?.match_id || functs.likedMatchId;
                            setShowItsAMatchModal(false);
                            navigation.push(namer.navigation.conversation, { matchId });
                        }} >
                            <Text style={matchStyles.primaryBtnText}>Start conversation</Text>
                        </Pressable>
                        <Pressable style={matchStyles.secondaryBtn} onPress={() => {
                            setShowItsAMatchModal(false);
                            if (!functs.onePersonProfile) {
                                functs.refreshPeoples();
                            } else {
                                navigation.popToTop();
                            }
                        }} >
                            <Text style={matchStyles.secondaryBtnText}>Continue swiping</Text>
                        </Pressable>
                    </Animated.View>
                </View>
            </Modal>



            {/* DISLIKED BUT WAS A MATCH */}
            <Modal visible={getShowDislikedMatchModal} transparent animationType="fade"
                onRequestClose={() => {
                    setShowDislikedMatchModal(false);
                    functs.refreshPeoples();
                }}>
                <View style={matchStyles.backdrop}>
                    <Animated.View style={[matchStyles.card, passedShakeStyle]}>
                        <Pressable style={matchStyles.closeButton} onPress={() => {setShowDislikedMatchModal(false); functs.refreshPeoples();}}>
                            <IIcon name="close" size={24} color="#cbd5e1" />
                        </Pressable>
                        <View style={styles.zcircle1} />
                        <View style={styles.zcircle2} />
                        <View style={styles.zcircle3} />

                        <Text style={matchStyles.title}>💔 You passed!</Text>
                        <Text style={matchStyles.subtitle}>but {getSkippedLastPerson?.user_fullname || "They"} already likes you.</Text>

                        <View style={[matchStyles.photoRow, { marginVertical: 10 }]}>
                            <View style={[matchStyles.photoCard, { transform: [], borderColor: '#f43f5e', marginRight: 0, marginLeft: 0 }]}>
                                <FastImage source={{ uri: String(imageDomain + (getSkippedLastPerson?.user_image?.[0]?.p ?? "")) }} style={{ width: '100%', height: '100%' }} resizeMode="cover"
                                    onError={() => logReport({ type: "http -image", logMessage: "Image load", url: imageDomain + (getSkippedLastPerson?.user_image?.[0]?.p ?? ""), useraction: 'Image Load', stackTrace: null })} />
                            </View>
                        </View>

                        <Text style={[matchStyles.subtitle, { color: '#fbbf24', fontWeight: '600' }]}>
                            Upgrade to rewind and recover this match!
                        </Text>

                        <Pressable style={[matchStyles.primaryBtn, { backgroundColor: '#f59e0b' }]} onPress={() => {
                            setShowDislikedMatchModal(false);
                            navigation.navigate(namer.navigation.subscription);
                        }}>
                            <Text style={matchStyles.primaryBtnText}>Upgrade to Rewind</Text>
                        </Pressable>

                        <Pressable style={matchStyles.secondaryBtn} onPress={() => {
                            setShowDislikedMatchModal(false);
                            functs.refreshPeoples();
                        }}>
                            <Text style={matchStyles.secondaryBtnText}>Keep swiping</Text>
                        </Pressable>

                    </Animated.View>
                </View>
            </Modal>

            {/* FULLSCREEN */}
            <ImageViewing
                images={currentUserImages.map((img: any) => ({ uri: imageDomain + img.p }))}
                imageIndex={getFullscreenClickImageIndex ?? 0}
                visible={!!getFullscreenClickImageIndex}
                onRequestClose={() => { setFullscreenClickImageIndex(null) }}
                swipeToCloseEnabled={true}
                doubleTapToZoomEnabled={true}
                presentationStyle="overFullScreen"
                animationType="fade"
            /> 

            {/* like / dislike / diamond tap feedback */}
            <ActionBurstOverlay burst={getActionBurst} onDone={() => setActionBurst(null)} />


        </View>
 

            <BottomSheet ref={bottomSheetRef_reportUser.ref} index={-1} enablePanDownToClose snapPoints={bottomSheetRef_reportUser.snap} backdropComponent={bottomsheet_renderBackdrop}>
                <BottomSheetView style={{ padding: 20 }}>
                    <ReportContent />
                </BottomSheetView>
            </BottomSheet>
        </>
    );
}



const PROMPT_GRADIENTS: [string, string][] = [
    ['#0f172a', '#1e2b4d'],
    ['#1e1b4b', '#3b0764'],
    ['#0c1e3d', '#134e4a'],
];

const deckStyles = StyleSheet.create({
    cardFooter: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 18, gap: 8 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    name: { color: '#fff', fontSize: 26, fontWeight: '800' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: 'rgba(15,23,42,0.75)', borderRadius: 18 },
    chipText: { color: '#e5e7eb', fontSize: 13, textTransform: 'capitalize' },
    detailCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginHorizontal: 5, marginTop: 14 },
    promptCard: { borderRadius: 16, padding: 18, marginTop: 14, overflow: 'hidden', position: 'relative' },
    promptQuoteDeco: { position: 'absolute', top: 2, right: 8 },
    promptTag: { alignSelf: 'flex-start', backgroundColor: 'rgba(56,189,248,0.16)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 12 },
    promptTagText: { color: '#7dd3fc', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
    promptAnswer: { color: '#fff', fontSize: 19, fontWeight: '700', lineHeight: 25, paddingRight: 30 },
    promptLikeBtn: { position: 'absolute', bottom: 14, right: 14, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 2 },
    detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
    detailItem: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, backgroundColor: '#f3f4f6', borderRadius: 12, flexBasis: '48%' },
    detailText: { color: '#0f172a', fontSize: 14, flexShrink: 1 },
    galleryImage: { width: 160, height: 200, borderRadius: 16, backgroundColor: colors.gray1 },
    actionDock: { position: 'absolute', bottom: 16, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 16 },
    circleBtn: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
    circleBtnGhost: { backgroundColor: '#fff' },
    circleBtnAccent: { backgroundColor: '#e0f2fe' },
    circleBtnPrimary: { backgroundColor: '#dcfce7' },
    cardShadow: { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 12 },
    tapZones: { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
    tapZone: { flex: 1 },
    progressDots: { position: 'absolute', top: 16, alignSelf: 'center', flexDirection: 'row', gap: 6, backgroundColor: 'rgba(0,0,0,0.3)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.4)' },
    dotActive: { backgroundColor: '#fff' },
    emptyStateWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 40 },
    emptyStateCard: { width: '100%', maxWidth: 410, borderRadius: 22, backgroundColor: '#ffffff', paddingVertical: 28, paddingHorizontal: 20, alignItems: 'center', gap: 10 },
    emptyStateIconWrap: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#e0f2fe', alignItems: 'center', justifyContent: 'center' },
    emptyStateTitle: { fontSize: 23, color: '#0f172a', fontWeight: '800', textAlign: 'center' },
    emptyStateSubtitle: { fontSize: 14, color: '#475569', lineHeight: 21, textAlign: 'center' },
    emptyStateActions: { width: '100%', gap: 10, marginTop: 8 },
    emptyStatePrimaryAction: { backgroundColor: '#0ea5e9', borderRadius: 14, paddingVertical: 12 },
    emptyStateSecondaryAction: { borderWidth: 1, borderColor: '#bae6fd', backgroundColor: '#f0f9ff', borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
    emptyStateSecondaryActionText: { fontSize: 15, color: '#0369a1', fontWeight: '700' },
});

const matchStyles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', padding: 24 },
    card: { width: '100%', maxWidth: 380, backgroundColor: '#0f172a', borderRadius: 24, padding: 20, alignItems: 'center', gap: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
    closeButton: { position: 'absolute', top: 12, right: 12, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)', zIndex: 10 },
    title: { fontSize: 28, fontWeight: '800', color: '#fff' },
    subtitle: { fontSize: 14, color: '#cbd5e1', textAlign: 'center' },
    photoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 10 },
    photoCard: { width: 130, height: 170, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.gray1, shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
    leftPhoto: { marginRight: -26, borderWidth: 2, borderColor: '#0ea5e9' },
    rightPhoto: { marginLeft: -26, borderWidth: 2, borderColor: '#22c55e' },
    primaryBtn: { width: '100%', backgroundColor: '#22c55e', paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
    primaryBtnText: { color: '#0f172a', fontSize: 16, fontWeight: '800' },
    secondaryBtn: { paddingVertical: 12 },
    secondaryBtnText: { color: '#38bdf8', fontSize: 15, fontWeight: '700' },
});
