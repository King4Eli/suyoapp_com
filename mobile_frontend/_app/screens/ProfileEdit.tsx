import React, {
    useState, useLayoutEffect, useRef, useMemo,
    useCallback, useEffect,
} from 'react';
import {
    View, Text, TextInput, Image, Pressable,
    KeyboardAvoidingView, Platform, TouchableOpacity,
    StyleSheet, LayoutAnimation,
} from 'react-native';
import RNFS from 'react-native-fs';
import { Loaderx, bottomsheet_renderBackdrop } from '../funcs/functions_stateful';
import { ScrollView } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    runOnJS,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import IIcon from 'react-native-vector-icons/Ionicons';
import MIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { namer } from '../funcs/static';
import { SafeAreaView } from 'react-native-safe-area-context';
import { _http_request, cacheStorage, help, hostServer, llStorage, mediaHandler, sleep, uploadHandler } from '../funcs/functions';
import { useHeaderHeight } from '@react-navigation/elements';
import BottomSheet, { BottomSheetScrollView, BottomSheetView } from '@gorhom/bottom-sheet';
import { Toastx } from '../funcs/customNotification';
import LinearGradient from 'react-native-linear-gradient';

// ─── Constants ───────────────────────────────────────────────────────────────
const GAP = 5;
const MAX_PHOTOS = 6;
const MAX_PROMPTS = 3;
const MAX_INTERESTS = 15;

// ─── Types ───────────────────────────────────────────────────────────────────
interface PhotoItem {
    p?: string;
    uri?: string;
    local?: boolean;
    w?: number;
    h?: number;
}

interface CellDim {
    w: number;
    h: number;
    x: number;
    y: number;
}

type PickerOption = {
    id: string;
    label: string;
};

type PickerSection = {
    title: string;
    options: PickerOption[];
};

type PickerSheetConfig = {
    title: string;
    subtitle?: string;
    selectedId?: string | null;
    sections: PickerSection[];
    onSelect: (id: string) => void;
};

// ─── Pure helpers ─────────────────────────────────────────────────────────────
function getCellDims(containerWidth: number): CellDim[] {
    const colW = (containerWidth - GAP) / 2;
    const smallH = colW * 0.65;
    const bigH = smallH * 2 + GAP;
    const bottomH = smallH;
    const thirdColW = (containerWidth - GAP * 2) / 3;
    return [
        { w: colW, h: bigH, x: 0, y: 0 },
        { w: colW, h: smallH, x: colW + GAP, y: 0 },
        { w: colW, h: smallH, x: colW + GAP, y: smallH + GAP },
        { w: thirdColW, h: bottomH, x: 0, y: bigH + GAP },
        { w: thirdColW, h: bottomH, x: thirdColW + GAP, y: bigH + GAP },
        { w: thirdColW, h: bottomH, x: (thirdColW + GAP) * 2, y: bigH + GAP },
    ];
}

/** Returns the cell index whose bounding rect contains (px, py), or -1. */
function hitTestCell(cells: CellDim[], px: number, py: number): number {
    for (let i = 0; i < cells.length; i++) {
        const c = cells[i];
        if (px >= c.x && px <= c.x + c.w && py >= c.y && py <= c.y + c.h) return i;
    }
    return -1;
}

function padImages(images: PhotoItem[]): PhotoItem[] {
    const arr = [...images];
    while (arr.length < MAX_PHOTOS) arr.push({});
    return arr.slice(0, MAX_PHOTOS);
}

function isEmptySlot(img: PhotoItem): boolean {
    return !img?.p && !img?.uri;
}

function getFileExtension(path: string): string {
    const cleaned = path.split('?')[0].split('#')[0];
    const parts = cleaned.split('.');
    if (parts.length < 2) return 'jpg';
    const ext = parts[parts.length - 1].toLowerCase().replace(/[^a-z0-9]/g, '');
    return ext || 'jpg';
}

function getMimeTypeFromExt(ext: string): string {
    const map: Record<string, string> = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
        gif: 'image/gif',
        bmp: 'image/bmp',
    };
    return map[ext] ?? 'application/octet-stream';
}

// ─── DraggablePhoto ───────────────────────────────────────────────────────────
// Defined at module level so React's Rules of Hooks are never violated.

interface DraggablePhotoProps {
    image: PhotoItem;
    slotIndex: number;
    cellWidth: number;
    cellHeight: number;
    x: number;
    y: number;
    imageUri: string;
    isDropTarget: boolean;
    onPress: (index: number) => void;
    onRemove: (index: number) => void;
    onDragStart: (index: number) => void;
    onDragMove: (index: number, tx: number, ty: number) => void;
    onDragEnd: (index: number, tx: number, ty: number) => void;
}

const DraggablePhoto = React.memo(({
    image, slotIndex, cellWidth, cellHeight, x, y,
    imageUri, isDropTarget,
    onPress, onRemove, onDragStart, onDragMove, onDragEnd,
}: DraggablePhotoProps) => {
    const empty = isEmptySlot(image);

    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const scale = useSharedValue(1);
    const zIdx = useSharedValue(1);
    const shadowOpacity = useSharedValue(0);

    const gesture = Gesture.Pan()
        .minDistance(8)
        .enabled(!empty)
        .onStart(() => {
            scale.value = withSpring(1.07, { damping: 14, stiffness: 200 });
            shadowOpacity.value = withTiming(0.4, { duration: 150 });
            zIdx.value = 100;
            runOnJS(onDragStart)(slotIndex);
        })
        .onUpdate(e => {
            translateX.value = e.translationX;
            translateY.value = e.translationY;
            runOnJS(onDragMove)(slotIndex, e.translationX, e.translationY);
        })
        .onEnd(e => {
            translateX.value = withSpring(0, { damping: 18, stiffness: 220 });
            translateY.value = withSpring(0, { damping: 18, stiffness: 220 });
            scale.value = withSpring(1);
            shadowOpacity.value = withTiming(0, { duration: 200 });
            zIdx.value = 1;
            runOnJS(onDragEnd)(slotIndex, e.translationX, e.translationY);
        })
        .onFinalize(() => {
            translateX.value = withSpring(0);
            translateY.value = withSpring(0);
            scale.value = withSpring(1);
            shadowOpacity.value = withTiming(0);
            zIdx.value = 1;
        });

    const animStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { scale: scale.value },
        ],
        zIndex: zIdx.value,
        shadowOpacity: shadowOpacity.value,
        elevation: shadowOpacity.value > 0.1 ? 10 : 0,
    }));

    return (
        <Animated.View style={[
            photoStyles.wrapper,
            { left: x, top: y, width: cellWidth, height: cellHeight },
            animStyle,
        ]}>
            <GestureDetector gesture={gesture}>
                <Animated.View style={{ flex: 1 }}>
                    <Pressable
                        style={[
                            photoStyles.cell,
                            empty && photoStyles.emptyCell,
                            isDropTarget && (empty ? photoStyles.dropTargetEmpty : photoStyles.dropTargetFilled),
                        ]}
                        onPress={() => onPress(slotIndex)}
                    >
                        {!empty ? (
                            <>
                                <Image
                                    key={imageUri || `empty-${slotIndex}`}
                                    source={{ uri: imageUri }}
                                    style={photoStyles.img}
                                    resizeMode="cover"
                                />

                                {/* Drop-target tint overlay */}
                                {isDropTarget && <View style={photoStyles.dropOverlay} />}

                                {/* Remove button */}
                                <Pressable
                                    style={photoStyles.removeBtn}
                                    onPress={() => onRemove(slotIndex)}
                                    hitSlop={6}
                                >
                                    <View style={photoStyles.removeBtnInner}>
                                        <IIcon name="close" size={12} color="#ff4444" />
                                    </View>
                                </Pressable>

                                {/* Drag handle dots */}
                                <View style={photoStyles.dragHandle} pointerEvents="none">
                                    {[...Array(6)].map((_, i) => (
                                        <View key={i} style={photoStyles.dragDot} />
                                    ))}
                                </View>

                                {/* Main badge */}
                                {slotIndex === 0 && (
                                    <View style={photoStyles.mainBadge}>
                                        <MIcons name="star" size={10} color="#fff" />
                                        <Text style={photoStyles.mainBadgeText}>Main</Text>
                                    </View>
                                )}
                            </>
                        ) : (
                            <View style={photoStyles.emptyContent}>
                                {isDropTarget
                                    ? <IIcon name="swap-horizontal-outline" size={24} color="#4f8ef7" />
                                    : <IIcon name="add" size={26} color="#c8c8c8" />
                                }
                            </View>
                        )}
                    </Pressable>
                </Animated.View>
            </GestureDetector>
        </Animated.View>
    );
});

const photoStyles = StyleSheet.create({
    wrapper: {
        position: 'absolute',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 12,
    },
    cell: {
        flex: 1,
        borderRadius: 18,
        overflow: 'hidden',
        backgroundColor: '#f8fafc',
    },
    emptyCell: {
        borderWidth: 1.4,
        borderColor: '#dbe3ef',
        borderStyle: 'dashed',
        backgroundColor: '#f8fafc',
    },
    dropTargetFilled: {
        borderWidth: 2.5,
        borderColor: '#4f8ef7',
    },
    dropTargetEmpty: {
        borderWidth: 2.5,
        borderColor: '#4f8ef7',
        borderStyle: 'solid',
        backgroundColor: '#eef3fe',
    },
    img: { width: '100%', height: '100%' },
    dropOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(79,142,247,0.22)',
    },
    emptyContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    removeBtn: {
        position: 'absolute', top: 5, right: 5, zIndex: 10,
    },
    removeBtnInner: {
        width: 26, height: 26, borderRadius: 13,
        backgroundColor: '#fff',
        alignItems: 'center', justifyContent: 'center',
        elevation: 4,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2, shadowRadius: 3,
    },
    dragHandle: {
        position: 'absolute', bottom: 6, right: 6,
        flexDirection: 'row', flexWrap: 'wrap', width: 14, gap: 2.5,
        opacity: 0.65,
    },
    dragDot: { width: 3.5, height: 3.5, borderRadius: 2, backgroundColor: '#fff' },
    mainBadge: {
        position: 'absolute', bottom: 7, left: 7,
        backgroundColor: 'rgba(15,23,42,0.68)',
        borderRadius: 999,
        paddingHorizontal: 8, paddingVertical: 4,
        flexDirection: 'row', alignItems: 'center', gap: 3,
    },
    mainBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
});

// ─── Photo Grid ───────────────────────────────────────────────────────────────

interface PhotoGridProps {
    images: PhotoItem[];
    containerWidth: number;
    dropTargetIndex: number | null;
    getImageUri: (index: number) => string;
    onPress: (index: number) => void;
    onRemove: (index: number) => void;
    onDragStart: (index: number) => void;
    onDragMove: (index: number, tx: number, ty: number) => void;
    onDragEnd: (index: number, tx: number, ty: number) => void;
    onLayout: (width: number) => void;
}

const PhotoGrid = React.memo(({
    images, containerWidth, dropTargetIndex, getImageUri,
    onPress, onRemove, onDragStart, onDragMove, onDragEnd, onLayout,
}: PhotoGridProps) => {
    if (containerWidth === 0) {
        return (
            <View
                onLayout={e => onLayout(e.nativeEvent.layout.width)}
                style={{ width: '100%', height: 10 }}
            />
        );
    }

    const cells = getCellDims(containerWidth);
    const bigH = cells[0].h;
    const botH = cells[3].h;
    const total = bigH + GAP + botH;
    const padded = padImages(images);

    return (
        <View
            onLayout={e => {
                const w = Math.floor(e.nativeEvent.layout.width);
                if (w !== containerWidth) onLayout(w);
            }}
            style={{ width: '100%', height: total }}
        >
            {cells.map((cell, idx) => (
                <DraggablePhoto
                    key={`${idx}-${padded[idx]?.p ?? padded[idx]?.uri ?? 'empty'}`}
                    image={padded[idx]}
                    slotIndex={idx}
                    cellWidth={cell.w}
                    cellHeight={cell.h}
                    x={cell.x}
                    y={cell.y}
                    imageUri={getImageUri(idx)}
                    isDropTarget={dropTargetIndex === idx}
                    onPress={onPress}
                    onRemove={onRemove}
                    onDragStart={onDragStart}
                    onDragMove={onDragMove}
                    onDragEnd={onDragEnd}
                />
            ))}
        </View>
    );
});

// ─── Main Screen ─────────────────────────────────────────────────────────────

export function Screen_editprofile({ navigation }: { navigation: any }) {
    const headerHeight = useHeaderHeight();

    const [getProfile, setProfile] = useState<any>(null);
    const __MAPPER = llStorage.CONFIG.get()?.mapper;

    const imageDomain = __MAPPER?.img_domain?.[0] ?? '';

    const [getProfileEdit, setProfileEdit] = useState({
        images: [] as PhotoItem[],

        // Basic info
        id: null as string | null,
        fullname: "",
        age: null as number | null,
        about: "",
        city: "",

        // Preferences/Attributes
        gender: null as string | null,
        relationshipgoal: null as string | null,
        children: null as string | null,
        smoking: null as string | null,
        drinking: null as string | null,
        pets: null as string | null,
        highEducation: null as string | null,
        ethnicity: null as string | null,
        bodytype: null as string | null,
        religion: null as string | null,
        politicalview: null as string | null,

        // Text fields
        hometown: "",
        schoolattended: "",
        languages: [] as string[],
    });

    // ── Profile state ──────────────────────────────────────────────────────   
    const [getPrompts, setPrompts] = useState<Array<{ q: string; a: string; d: string }>>(
        Array.isArray(getProfile?.user_bio_prompt) ? getProfile.user_bio_prompt : []
    );
    const [getInterests, setInterests] = useState<string[]>(
        Array.isArray(getProfile?.user_bio_interests) ? getProfile.user_bio_interests : []
    );



    // profile
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const [profile] = await Promise.all([cacheStorage.getCurrentUserProfile()]);

                if (mounted && profile) {
                    setProfile(profile);
                    setProfileEdit({
                        // Photos
                        images: profile?.profile?.images ?? [],

                        // Basic info
                        id: profile?.profile?.id ?? null,
                        fullname: profile?.profile?.fullname ?? '',
                        age: profile?.profile?.dob ?? null,
                        about: profile?.bio?.about ?? '',
                        city: profile?.profile?.location?.city ?? '',

                        // Preferences/Attributes
                        gender: profile?.bio?.gender ?? null,
                        relationshipgoal: profile?.bio?.relationshipgoal ?? null,
                        children: profile?.bio?.children ?? null,
                        smoking: profile?.bio?.smoking ?? null,
                        drinking: profile?.bio?.drinking ?? null,
                        pets: profile?.bio?.haspet ?? null,
                        highEducation: profile?.bio?.highesteducation ?? null,
                        ethnicity: profile?.bio?.ethnicity ?? null,
                        bodytype: profile?.bio?.bodytype ?? null,
                        religion: profile?.bio?.religion ?? null,
                        politicalview: profile?.bio?.politicalview ?? null,

                        // Text fields
                        hometown: profile?.bio?.hometown ?? '',
                        schoolattended: profile?.bio?.schoolattended ?? '',
                        languages: profile?.bio?.language ?? [],
                    });
                    setPrompts(Array.isArray(profile?.user_bio_prompt) ? profile.user_bio_prompt : []);
                    setInterests(Array.isArray(profile?.user_bio_interests) ? profile.user_bio_interests : []);
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
    const updateProfileEdit = useCallback((
        updates:
            Partial<typeof getProfileEdit>
            | ((prev: typeof getProfileEdit) => Partial<typeof getProfileEdit>)
    ) => {
        setProfileEdit(prev => ({
            ...prev,
            ...(typeof updates === 'function' ? updates(prev) : updates),
        }));
    }, []);




    // ── Drag state ─────────────────────────────────────────────────────────
    const [containerWidth, setContainerWidth] = useState(0);
    const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

    // ── Bottom sheet refs ───────────────────────────────────────────────────
    const addNewPrompt_ref = useRef<BottomSheet>(null);
    const addInterests_ref = useRef<BottomSheet>(null);
    const pickerSheet_ref = useRef<BottomSheet>(null);
    const [showAddNewPromptSheet, setShowAddNewPromptSheet] = useState(false);
    const [showAddInterestsSheet, setShowAddInterestsSheet] = useState(false);
    const [pickerSheet, setPickerSheet] = useState<PickerSheetConfig | null>(null);
    const addNewPromptSnapPoints = useMemo(() => ['72%', '88%'], []);
    const addInterestsSnapPoints = useMemo(() => ['72%', '90%'], []);
    const pickerSnapPoints = useMemo(() => ['58%', '82%'], []);

    // ── Header ─────────────────────────────────────────────────────────────
    useLayoutEffect(() => {
        navigation.setOptions({
            headerTitle: () => (
                <Text style={pgStyles.headerTitle}>Edit Profile</Text>
            ),
            headerRight: () => (
                <View style={pgStyles.headerActions}>
                    {getProfileEdit.id && <Pressable
                        style={pgStyles.previewBtn}
                        onPress={() =>
                            navigation.push(namer.navigation.peoplesOnePerson, {
                                getOnePersonId: getProfileEdit.id,
                                alreadyLiked: true,
                                previewProfile: true,
                            })
                        }
                    >
                        <Text style={pgStyles.previewBtnText}>Preview</Text>
                    </Pressable>}
                    <Pressable
                        style={[pgStyles.saveBtn]}
                        onPress={handleSaveProfile}
                    >
                        <Text style={pgStyles.saveBtnText}>Save</Text>
                    </Pressable>
                </View>
            ),
        });
    });

    // ── Helpers ────────────────────────────────────────────────────────────
    const getImageUri = useCallback((index: number): string => {
        const target = getProfileEdit?.images?.[index];
        if (!target) return '';
        const path = target?.p ?? target?.uri ?? '';
        const isLocal = target?.local || path.startsWith('file:') || path.startsWith('content:');

        return isLocal ? path : String(imageDomain + path);
    }, [getProfileEdit?.images, __MAPPER]);

    // ── Save ───────────────────────────────────────────────────────────────
    const handleSaveProfile = async () => {
        Loaderx.show();
        try {
            const orderedImageMeta = padImages(getProfileEdit?.images)
                .map((img, index) => {
                    const path = img?.p ?? img?.uri ?? '';
                    if (!path) return null;
                    return {
                        p: path,
                        w: img?.w ?? null,
                        h: img?.h ?? null,
                        o: index,
                    };
                })
                .filter(Boolean);

            const response = await _http_request({
                reqType: 'POST',
                customApiUrl: hostServer() + '/api/core/v1/pushProfile',
                bodyArray: {
                    prof_about: getProfileEdit?.about,
                    prof_smoking: getProfileEdit?.smoking,
                    prof_drinking: getProfileEdit?.drinking,
                    prof_children: getProfileEdit?.children,
                    prof_ethnicity: getProfileEdit?.ethnicity,
                    //prof_pet: getProfileEdit?.pets,
                    prof_religion: getProfileEdit?.religion,
                    prof_bodytype: getProfileEdit?.bodytype,
                    prof_highesteducation: getProfileEdit?.highEducation,
                    prof_relationshipgoal: getProfileEdit?.relationshipgoal,
                    prof_languages: JSON.stringify(getProfileEdit?.languages ?? []),
                    prof_gender: getProfileEdit?.gender,
                    prof_hometown: getProfileEdit?.hometown,
                    prof_schoolattended: getProfileEdit?.schoolattended,
                    prof_political: getProfileEdit?.politicalview,
                    prof_prompts: JSON.stringify(getPrompts ?? []),
                    prof_interests: JSON.stringify(getInterests ?? []),
                    prof_images_meta: JSON.stringify(orderedImageMeta),
                },
            });
            if (response?.code === 200) {
                Toastx.show({ type: 'success', message: response?.userpreferences?.message ?? 'Profile updated!' });
                await cacheStorage.getCurrentUserProfile(true);
                await sleep(2000);
                Loaderx.hide();
                navigation.goBack();
            } else {
                Toastx.show({ type: 'error', message: response?.userpreferences?.message ?? 'Error updating profile!' });
            }
        } catch (error: any) {
            Toastx.show({ type: 'error', message: error?.message ?? 'Unable to save profile.' });
        } finally {
            Loaderx.hide();
        }
    };

    // ── Photo actions ──────────────────────────────────────────────────────
    const handlePress = useCallback(async (index: number) => {
        const media = await mediaHandler.handleSelectFromGallery({
            mediaType: 'photo',
            selectionLimit: 1,
        });
        if (!media || media.length === 0) return;
        const asset = media[0];
        const localPath = asset?.uri ?? '';
        if (!localPath) return;

        Loaderx.show();
        try {
            const ext = getFileExtension(localPath);
            const presigned = await uploadHandler.requestPresignedURL_Upload(ext, 'profile-media');
            const uploadFilePath = localPath.startsWith('file://') ? localPath.replace('file://', '') : localPath;
            const contentType = getMimeTypeFromExt(ext);

            const uploadResult = await RNFS.uploadFiles({
                toUrl: presigned.uploadUrl,
                files: [
                    {
                        name: 'file',
                        filename: `profile_${Date.now()}_${index}.${ext}`,
                        filepath: uploadFilePath,
                        filetype: contentType,
                    },
                ],
                method: presigned.method || 'PUT',
                headers: {
                    'Content-Type': contentType,
                },
                binaryStreamOnly: true,
            }).promise;

            if (uploadResult.statusCode < 200 || uploadResult.statusCode >= 300) {
                throw new Error('Profile image upload failed.');
            }

            const uploadedPath = "/" + uploadHandler.joinPath(presigned.bucket, presigned.fileKey);
            console.log(uploadedPath)
            updateProfileEdit(prev => {
                const updated = [...prev.images];
                while (updated.length <= index) updated.push({});
                updated[index] = {
                    ...(updated[index] ?? {}),
                    p: uploadedPath,
                    uri: uploadedPath,
                    local: false,
                    w: asset.width,
                    h: asset.height,
                };
                return {
                    images: updated.slice(0, MAX_PHOTOS),
                };
            });
        } catch (error: any) {
            Toastx.show({ type: 'error', message: error?.message ?? 'Unable to upload profile image.' });
        } finally {
            Loaderx.hide();
        }
    }, [updateProfileEdit]);

    const handleRemoveImage = useCallback((index: number) => {
        updateProfileEdit(prev => {
            const updated = [...prev.images];
            updated[index] = {};
            return { images: updated };
        });
    }, [updateProfileEdit]);

    // ── Drag callbacks ─────────────────────────────────────────────────────
    const handleDragStart = useCallback((_index: number) => {
        // placeholder — extend if you need global drag state
    }, []);

    const handleDragMove = useCallback((fromIndex: number, tx: number, ty: number) => {
        if (containerWidth === 0) return;
        const cells = getCellDims(containerWidth);
        const from = cells[fromIndex];
        const cx = from.x + from.w / 2 + tx;
        const cy = from.y + from.h / 2 + ty;
        const hit = hitTestCell(cells, cx, cy);
        setDropTargetIndex(hit !== -1 && hit !== fromIndex ? hit : null);
    }, [containerWidth]);

    const handleDragEnd = useCallback((fromIndex: number, tx: number, ty: number) => {
        setDropTargetIndex(null);
        if (containerWidth === 0) return;
        const cells = getCellDims(containerWidth);
        const from = cells[fromIndex];
        const cx = from.x + from.w / 2 + tx;
        const cy = from.y + from.h / 2 + ty;
        const toIndex = hitTestCell(cells, cx, cy);
        if (toIndex !== -1 && toIndex !== fromIndex) {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            updateProfileEdit(prev => {
                const updated = [...prev.images];
                [updated[fromIndex], updated[toIndex]] = [updated[toIndex], updated[fromIndex]];
                return { images: updated };
            });
        }
    }, [containerWidth, updateProfileEdit]);

    const handleGridLayout = useCallback((w: number) => {
        setContainerWidth(w);
    }, []);

    // ── Prompt helpers ─────────────────────────────────────────────────────
    const removePrompt = useCallback((index: number) => {
        setPrompts(prev => prev.filter((_, i) => i !== index));
    }, []);

    // ── Interest helpers ───────────────────────────────────────────────────
    const toggleInterest = useCallback((item: string) => {
        setInterests(prev => {
            if (prev.includes(item)) return prev.filter(v => v !== item);
            if (prev.length >= MAX_INTERESTS) {
                Toastx.show({ message: `Max ${MAX_INTERESTS} interests allowed.`, type: 'info' });
                return prev;
            }
            return [...prev, item];
        });
    }, []);

    const removeInterest = useCallback((item: string) => {
        setInterests(prev => prev.filter(v => v !== item));
    }, []);

    // ── Radio builder ──────────────────────────────────────────────────────
    const buildOptions = (map: Record<string, string> | undefined): PickerOption[] =>
        Object.entries(map ?? {}).map(([key, value]) => ({
            id: key,
            label: value as string,
        }));

    const openPicker = useCallback((config: PickerSheetConfig) => {
        setPickerSheet(config);
    }, []);

    const closePicker = useCallback(() => {
        pickerSheet_ref.current?.close();
        setPickerSheet(null);
    }, []);

    // ─────────────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={[pgStyles.screen, { paddingTop: headerHeight }]} edges={['bottom']} >

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={0}
                style={{ flex: 1 }}
            >
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={pgStyles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                    automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={pgStyles.formStack}>

                        {/* ── Photo Grid ───────────────────────────────── */}
                        <View style={pgStyles.sectionCard}>
                            <View style={pgStyles.sectionHeader}>
                                <View style={pgStyles.sectionIcon}>
                                    <MIcons name="image-multiple-outline" size={18} color="#e8546f" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={pgStyles.sectionLabel}>Profile Photos</Text>
                                    <Text style={pgStyles.sectionHint}>Tap to replace. Drag to reorder.</Text>
                                </View>
                            </View>

                            <PhotoGrid
                                images={getProfileEdit.images}
                                containerWidth={containerWidth}
                                dropTargetIndex={dropTargetIndex}
                                getImageUri={getImageUri}
                                onPress={handlePress}
                                onRemove={handleRemoveImage}
                                onDragStart={handleDragStart}
                                onDragMove={handleDragMove}
                                onDragEnd={handleDragEnd}
                                onLayout={handleGridLayout}
                            />
                        </View>

                        {/* ── Vibes Banner ──────────────────────────────── */}
                        <LinearGradient
                            colors={['#e8546f', '#f27a9c']}
                            style={pgStyles.bannerCard}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <View style={pgStyles.bannerRow}>
                                <View style={{ gap: 6, flex: 1 }}>
                                    <View style={pgStyles.bannerBadge}>
                                        <MIcons name="heart-multiple-outline" color="#e8546f" size={14} />
                                        <Text style={pgStyles.bannerBadgeText}>Vibes &amp; Energy</Text>
                                    </View>
                                    <Text style={pgStyles.bannerTitle}>Show your best self today</Text>
                                    <Text style={pgStyles.bannerSubtitle}>
                                        Update a prompt and write a bio to make it easy for others to start a conversation with you.
                                    </Text>
                                </View>
                                <MIcons name="flower-tulip-outline" size={78} color="rgba(255,255,255,0.75)" />
                            </View>
                        </LinearGradient>

                        {/* ── Full Name (locked) ───────────────────────── */}
                        <View style={pgStyles.formField}>
                            <View style={pgStyles.inputHeader}>
                                <Text style={pgStyles.fieldLabel}>Full Name</Text>
                                <IIcon name="lock-closed" size={15} color="#94a3b8" />
                            </View>
                            <TextInput
                                style={[pgStyles.textInput, pgStyles.readOnlyInput]}
                                value={getProfileEdit.fullname}
                                readOnly
                            />
                        </View>

                        {/* ── Age (locked) ─────────────────────────────── */}
                        <View style={pgStyles.formField}>
                            <View style={pgStyles.inputHeader}>
                                <Text style={pgStyles.fieldLabel}>Age</Text>
                                <IIcon name="lock-closed" size={15} color="#94a3b8" />
                            </View>
                            <TextInput
                                style={[pgStyles.textInput, pgStyles.readOnlyInput]}
                                value={help.getageFromDOB((getProfileEdit?.age)?.toString() ?? "") ?? '—'}
                                readOnly
                            />
                        </View>

                        {/* ── About ────────────────────────────────────── */}
                        <View style={pgStyles.formField}>
                            <View style={pgStyles.inputHeader}>
                                <Text style={pgStyles.fieldLabel}>About you</Text>
                                <IIcon name="create-outline" size={17} color="#888" />
                            </View>
                            <TextInput
                                style={[pgStyles.textInput, pgStyles.textArea]}
                                multiline
                                numberOfLines={8}
                                value={getProfileEdit.about}
                                onChangeText={(e) => updateProfileEdit({ about: e })}
                                placeholder="Write something about yourself…"
                                placeholderTextColor="#94a3b8"
                                maxLength={400}
                            />
                            <Text style={pgStyles.charCounter}>
                                {getProfileEdit.about?.length ?? 0}/400 characters
                            </Text>
                        </View>

                        <FormGroup title="Core Details" hint="These help people understand who you are looking for.">
                            <PickerField
                                label="Intentions"
                                value={__MAPPER?.bio_intent?.[getProfileEdit.relationshipgoal ?? ""]}
                                icon="heart-outline"
                                onPress={() => openPicker({
                                    title: 'What are your intentions?',
                                    selectedId: getProfileEdit.relationshipgoal,
                                    sections: [{ title: 'Dating goals', options: buildOptions(__MAPPER?.bio_intent) }],
                                    onSelect: (id) => updateProfileEdit({ relationshipgoal: id }),
                                })}
                            />
                            <PickerField
                                label="Gender"
                                value={__MAPPER?.bio_gender?.[getProfileEdit.gender ?? ""]}
                                icon="account-outline"
                                onPress={() => openPicker({
                                    title: 'What is your gender?',
                                    selectedId: getProfileEdit.gender,
                                    sections: [{ title: 'Gender', options: buildOptions(__MAPPER?.bio_gender) }],
                                    onSelect: (id) => updateProfileEdit({ gender: id }),
                                })}
                            />
                        </FormGroup>

                        {/* ── Interests ────────────────────────────────── */}
                        <View style={pgStyles.formField}>
                            <Pressable
                                style={{ gap: 8 }}
                                onPress={() => setShowAddInterestsSheet(true)}
                            >
                                <View style={pgStyles.inputHeader}>
                                    <Text style={pgStyles.fieldLabel}>
                                        Interests
                                        <Text style={pgStyles.countBadge}> {getInterests.length}/{MAX_INTERESTS}</Text>
                                    </Text>
                                    <MIcons name="cursor-default-click-outline" size={17} color="#888" />
                                </View>

                                {getInterests.length === 0 ? (
                                    <Text style={pgStyles.placeholder}>Tap to select your interests</Text>
                                ) : (
                                    <View style={pgStyles.chipRow}>
                                        {getInterests.map((interest, i) => (
                                            <View key={i} style={pgStyles.chip}>
                                                <Text style={pgStyles.chipText}>{interest}</Text>
                                                <Pressable
                                                    hitSlop={6}
                                                    onPress={() => removeInterest(interest)}
                                                    style={pgStyles.chipRemove}
                                                >
                                                    <Text style={pgStyles.chipRemoveText}>×</Text>
                                                </Pressable>
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </Pressable>
                        </View>

                        <FormGroup title="Background" hint="A few real-world details for better context.">
                            <StaticField
                                label="Location"
                                value={getProfileEdit.city || '—'}
                                icon="map-marker-outline"
                            />
                            <InlineTextField
                                label="Hometown"
                                value={getProfileEdit.hometown}
                                icon="home-heart"
                                placeholder="Where are you from?"
                                maxLength={45}
                                onChangeText={(text) => updateProfileEdit({ hometown: text })}
                            />
                            <PickerField
                                label="Highest Education"
                                value={__MAPPER?.bio_education?.[getProfileEdit.highEducation ?? '']}
                                icon="school-outline"
                                onPress={() => openPicker({
                                    title: 'Highest education achieved?',
                                    selectedId: getProfileEdit.highEducation,
                                    sections: [{ title: 'Education', options: buildOptions(__MAPPER?.bio_education) }],
                                    onSelect: (id) => updateProfileEdit({ highEducation: id }),
                                })}
                            />
                            <InlineTextField
                                label="Languages"
                                value={getProfileEdit.languages.join(', ')}
                                icon="translate"
                                placeholder="Languages you speak (comma separated)"
                                onChangeText={(text) => updateProfileEdit({
                                    languages: text
                                        .split(',')
                                        .map((item) => item.trim())
                                        .filter(Boolean)
                                })}
                            />
                            <InlineTextField
                                label="School Attended"
                                value={getProfileEdit.schoolattended}
                                icon="school"
                                placeholder="What school did you attend?"
                                maxLength={45}
                                onChangeText={(text) => updateProfileEdit({ schoolattended: text })}
                            />
                        </FormGroup>

                        {/* ── Prompts ──────────────────────────────────── */}
                        <View style={pgStyles.formField}>
                            <Text style={pgStyles.fieldLabel}>
                                Prompts
                                <Text style={pgStyles.countBadge}> {getPrompts.length}/{MAX_PROMPTS}</Text>
                            </Text>

                            {getPrompts.map((item, index) => (
                                <View key={index} style={pgStyles.promptCard}>
                                    <Pressable
                                        style={pgStyles.promptRemove}
                                        onPress={() => removePrompt(index)}
                                        hitSlop={6}
                                    >
                                        <IIcon name="close-circle" size={20} color="#ff4444" />
                                    </Pressable>
                                    <Text style={pgStyles.promptQuestion}>{item?.q}</Text>
                                    <TextInput
                                        style={[pgStyles.textInput, pgStyles.promptAnswer]}
                                        value={item?.a}
                                        placeholder={item?.q}
                                        placeholderTextColor="#94a3b8"
                                        multiline
                                        maxLength={140}
                                        onChangeText={text => {
                                            setPrompts(prev => {
                                                const updated = [...prev];
                                                updated[index] = { ...updated[index], a: text };
                                                return updated;
                                            });
                                        }}
                                    />
                                </View>
                            ))}

                            {getPrompts.length < MAX_PROMPTS && (
                                <Pressable
                                    style={pgStyles.addPromptBtn}
                                    onPress={() => setShowAddNewPromptSheet(true)}
                                >
                                    <MIcons name="plus-circle-outline" size={18} color="#e8546f" />
                                    <Text style={pgStyles.addPromptText}>Add a Prompt</Text>
                                </Pressable>
                            )}
                        </View>

                        <FormGroup title="Lifestyle" hint="Optional details that make matching more thoughtful.">
                            {[
                                { label: 'Children', title: 'Do you have children?', icon: 'human-male-child', map: __MAPPER?.bio_children, state: getProfileEdit.children, set: (id: string) => updateProfileEdit({ children: id }) },
                                { label: 'Smoking', title: 'Do you smoke?', icon: 'smoking-off', map: __MAPPER?.bio_smoking, state: getProfileEdit.smoking, set: (id: string) => updateProfileEdit({ smoking: id }) },
                                { label: 'Drinking', title: 'Do you drink?', icon: 'glass-cocktail', map: __MAPPER?.bio_drinking, state: getProfileEdit.drinking, set: (id: string) => updateProfileEdit({ drinking: id }) },
                                { label: 'Pets', title: 'Do you have a pet?', icon: 'paw-outline', map: __MAPPER?.bio_pets, state: getProfileEdit.pets, set: (id: string) => updateProfileEdit({ pets: id }) },
                            ].map(({ label, title, icon, map, state, set }) => (
                                <PickerField
                                    key={title}
                                    label={label}
                                    value={(map as Record<string, string>)?.[state ?? '']}
                                    icon={icon}
                                    onPress={() => openPicker({
                                        title,
                                        selectedId: state,
                                        sections: [{ title: 'Lifestyle', options: buildOptions(map as Record<string, string>) }],
                                        onSelect: set,
                                    })}
                                />
                            ))}
                        </FormGroup>

                        <FormGroup title="Identity" hint="Share as much or as little as feels right.">
                            {[
                                { label: 'Religion', title: 'What is your religion?', icon: 'hands-pray', map: __MAPPER?.bio_religion, state: getProfileEdit.religion, set: (id: string) => updateProfileEdit({ religion: id }) },
                                { label: 'Ethnicity', title: 'What is your ethnicity?', icon: 'account-group-outline', map: __MAPPER?.bio_ethnicity, state: getProfileEdit.ethnicity, set: (id: string) => updateProfileEdit({ ethnicity: id }) },
                                { label: 'Body Type', title: 'Describe your body type', icon: 'human', map: __MAPPER?.bio_bodytype, state: getProfileEdit.bodytype, set: (id: string) => updateProfileEdit({ bodytype: id }) },
                                { label: 'Political Views', title: 'Political views?', icon: 'scale-balance', map: __MAPPER?.bio_politicalview, state: getProfileEdit.politicalview, set: (id: string) => updateProfileEdit({ politicalview: id }) },
                            ].map(({ label, title, icon, map, state, set }) => (
                                <PickerField
                                    key={title}
                                    label={label}
                                    value={(map as Record<string, string>)?.[state ?? '']}
                                    icon={icon}
                                    onPress={() => openPicker({
                                        title,
                                        selectedId: state,
                                        sections: [{ title: 'Identity', options: buildOptions(map as Record<string, string>) }],
                                        onSelect: set,
                                    })}
                                />
                            ))}
                        </FormGroup>

                    </View>
                </ScrollView>
            </KeyboardAvoidingView>


            {/* ── Add New Prompt Bottom Sheet ───────────────────────────────── */}
            {showAddNewPromptSheet && <BottomSheet
                ref={addNewPrompt_ref}
                index={0}
                enablePanDownToClose
                snapPoints={addNewPromptSnapPoints}
                backdropComponent={bottomsheet_renderBackdrop}
                onClose={() => setShowAddNewPromptSheet(false)}
            >
                <BottomSheetView style={pgStyles.sheetBody}>
                    <Text style={pgStyles.sheetTitle}>Add a Prompt</Text>
                    <BottomSheetScrollView showsVerticalScrollIndicator={false} contentContainerStyle={pgStyles.sheetScrollContent}>
                        {Object.values(__MAPPER?.bio_prompt ?? {})
                            .filter(prompt => !getPrompts.map(p => p.q).includes(prompt as string))
                            .map((prompt: any, index: number) => (
                                <View key={index} style={pgStyles.promptPickerCard}>
                                    <Text style={pgStyles.promptQuestion}>{prompt}</Text>
                                    <PromptDraft
                                        prompt={prompt}
                                        onSave={(answer) => {
                                            if (!getPrompts.map(p => p.q).includes(prompt)) {
                                                const now = new Date();
                                                const d =
                                                    `${now.getFullYear()}` +
                                                    `${String(now.getMonth() + 1).padStart(2, '0')}` +
                                                    `${String(now.getDate()).padStart(2, '0')}` +
                                                    `${String(now.getHours()).padStart(2, '0')}` +
                                                    `${String(now.getMinutes()).padStart(2, '0')}` +
                                                    `${String(now.getSeconds()).padStart(2, '0')}`;
                                                setPrompts(prev => [...prev, { q: prompt, a: answer.trim(), d }]);
                                            }
                                            addNewPrompt_ref.current?.close();
                                        }}
                                    />
                                </View>
                            ))}
                    </BottomSheetScrollView>
                </BottomSheetView>
            </BottomSheet>}

            {/* ── Interests Bottom Sheet ────────────────────────────────────── */}
            {showAddInterestsSheet && <BottomSheet
                ref={addInterests_ref}
                index={0}
                enablePanDownToClose
                snapPoints={addInterestsSnapPoints}
                backdropComponent={bottomsheet_renderBackdrop}
                onClose={() => setShowAddInterestsSheet(false)}
            >
                <BottomSheetView style={pgStyles.sheetBody}>
                    <View style={pgStyles.sheetHeader}>
                        <Text style={pgStyles.sheetTitle}>Your Interests</Text>
                        <Text style={pgStyles.countBadge}>{getInterests.length}/{MAX_INTERESTS} selected</Text>
                    </View>
                    <BottomSheetScrollView
                        contentContainerStyle={pgStyles.sheetScrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {Object.entries((__MAPPER?.bio_interests as Record<string, string[]>) ?? {}).map(([category, items]) => (
                            <View key={category} style={pgStyles.interestCategory}>
                                <Text style={pgStyles.interestCategoryTitle}>{category}</Text>
                                <View style={pgStyles.chipRow}>
                                    {items.map((item: string, idx: number) => {
                                        const selected = getInterests.includes(item);
                                        return (
                                            <TouchableOpacity
                                                key={idx}
                                                style={[pgStyles.chip, selected && pgStyles.chipSelected]}
                                                onPress={() => toggleInterest(item)}
                                                activeOpacity={0.75}
                                            >
                                                <Text style={[pgStyles.chipText, selected && pgStyles.chipTextSelected]}>
                                                    {item}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>
                        ))}
                    </BottomSheetScrollView>
                </BottomSheetView>
            </BottomSheet>}

            {pickerSheet && <BottomSheet
                ref={pickerSheet_ref}
                index={0}
                enablePanDownToClose
                snapPoints={pickerSnapPoints}
                backdropComponent={bottomsheet_renderBackdrop}
                onClose={() => setPickerSheet(null)}
            >
                <BottomSheetView style={pgStyles.sheetBody}>
                    <View style={pgStyles.sheetHeader}>
                        <View style={{ flex: 1 }}>
                            <Text style={pgStyles.sheetTitle}>{pickerSheet.title}</Text>
                            {!!pickerSheet.subtitle && <Text style={pgStyles.sectionHint}>{pickerSheet.subtitle}</Text>}
                        </View>
                        <Pressable style={pgStyles.sheetCloseButton} onPress={closePicker}>
                            <IIcon name="close" size={18} color="#64748b" />
                        </Pressable>
                    </View>
                    <BottomSheetScrollView contentContainerStyle={pgStyles.sheetScrollContent} showsVerticalScrollIndicator={false}>
                        {pickerSheet.sections.map(section => (
                            <View key={section.title} style={pgStyles.pickerSectionCard}>
                                <Text style={pgStyles.pickerSectionTitle}>{section.title}</Text>
                                <View style={pgStyles.pickerOptions}>
                                    {section.options.map(option => {
                                        const selected = String(pickerSheet.selectedId ?? '') === option.id;
                                        return (
                                            <TouchableOpacity
                                                key={option.id}
                                                style={[pgStyles.pickerOption, selected && pgStyles.pickerOptionSelected]}
                                                activeOpacity={0.82}
                                                onPress={() => {
                                                    pickerSheet.onSelect(option.id);
                                                    closePicker();
                                                }}
                                            >
                                                <Text style={[pgStyles.pickerOptionText, selected && pgStyles.pickerOptionTextSelected]}>
                                                    {option.label}
                                                </Text>
                                                {selected && <IIcon name="checkmark-circle" size={20} color="#e8546f" />}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>
                        ))}
                    </BottomSheetScrollView>
                </BottomSheetView>
            </BottomSheet>}
        </SafeAreaView >
    );
}

const FormGroup = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => (
    <View style={pgStyles.groupCard}>
        <View style={pgStyles.groupHeader}>
            <Text style={pgStyles.groupTitle}>{title}</Text>
            {!!hint && <Text style={pgStyles.groupHint}>{hint}</Text>}
        </View>
        <View style={pgStyles.groupFields}>{children}</View>
    </View>
);

const PickerField = ({
    label,
    value,
    icon,
    onPress,
}: {
    label: string;
    value?: string | null;
    icon: string;
    onPress: () => void;
}) => (
    <Pressable style={pgStyles.pickerField} onPress={onPress}>
        <View style={pgStyles.pickerFieldIcon}>
            <MIcons name={icon} size={18} color="#e8546f" />
        </View>
        <View style={{ flex: 1 }}>
            <Text style={pgStyles.fieldLabel}>{label}</Text>
            <Text style={[pgStyles.pickerFieldValue, !value && pgStyles.pickerFieldPlaceholder]}>
                {value || 'Choose an option'}
            </Text>
        </View>
        <MIcons name="chevron-right" size={22} color="#94a3b8" />
    </Pressable>
);

const StaticField = ({
    label,
    value,
    icon,
}: {
    label: string;
    value: string;
    icon: string;
}) => (
    <View style={pgStyles.inlineField}>
        <View style={pgStyles.pickerFieldIcon}>
            <MIcons name={icon} size={18} color="#e8546f" />
        </View>
        <View style={{ flex: 1 }}>
            <Text style={pgStyles.fieldLabel}>{label}</Text>
            <Text style={pgStyles.inlineFieldValue}>{value}</Text>
        </View>
    </View>
);

const InlineTextField = ({
    label,
    value,
    icon,
    placeholder,
    maxLength,
    onChangeText,
}: {
    label: string;
    value: string;
    icon: string;
    placeholder: string;
    maxLength?: number;
    onChangeText: (text: string) => void;
}) => (
    <View style={pgStyles.inlineField}>
        <View style={pgStyles.pickerFieldIcon}>
            <MIcons name={icon} size={18} color="#e8546f" />
        </View>
        <View style={{ flex: 1, gap: 6 }}>
            <Text style={pgStyles.fieldLabel}>{label}</Text>
            <TextInput
                style={pgStyles.inlineInput}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor="#94a3b8"
                maxLength={maxLength}
            />
        </View>
    </View>
);

const PromptDraft = ({ prompt, onSave }: { prompt: string; onSave: (answer: string) => void }) => {
    const [text, setText] = useState('');

    return (
        <View style={pgStyles.promptSheetCard}>
            <TextInput
                style={[pgStyles.textInput, pgStyles.promptSheetInput]}
                value={text}
                onChangeText={setText}
                placeholder={prompt}
                placeholderTextColor="#94a3b8"
                maxLength={140}
                multiline
            />
            <Pressable style={pgStyles.sheetSaveBtn} onPress={() => onSave(text)}>
                <Text style={pgStyles.sheetSaveBtnText}>Save Prompt</Text>
            </Pressable>
        </View>
    );
};

// ─── Page-level styles ────────────────────────────────────────────────────────
const pgStyles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#f8fafc',
        paddingHorizontal: 0,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 14,
        paddingBottom: 96,
    },
    formStack: {
        gap: 14,
        marginBottom: 12,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#0f172a',
    },
    headerActions: {
        paddingRight: 12,
        flexDirection: 'row',
        gap: 10,
        alignItems: 'center',
    },
    previewBtn: {
        minHeight: 36,
        justifyContent: 'center',
        borderRadius: 999,
        paddingHorizontal: 12,
        backgroundColor: '#f1f5f9',
    },
    previewBtnText: {
        fontSize: 13,
        color: '#475569',
        fontWeight: '800',
    },
    saveBtn: {
        minHeight: 36,
        backgroundColor: '#e8546f',
        paddingHorizontal: 16,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#e8546f',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.18,
        shadowRadius: 12,
        elevation: 3,
    },
    saveBtnText: {
        color: '#fff',
        fontWeight: '900',
        fontSize: 14,
    },

    sectionCard: {
        borderRadius: 22,
        backgroundColor: '#fff',
        padding: 14,
        gap: 12,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.06,
        shadowRadius: 18,
        elevation: 3,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    sectionIcon: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#fff1f5',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sectionLabel: {
        fontSize: 14,
        fontWeight: '900',
        color: '#0f172a',
        textTransform: 'uppercase',
    },
    sectionHint: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '700',
        marginTop: 2,
    },

    bannerCard: {
        borderRadius: 22,
        overflow: 'hidden',
        shadowColor: '#e8546f',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.14,
        shadowRadius: 18,
        elevation: 3,
    },
    bannerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
    },
    bannerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 5,
        alignSelf: 'flex-start',
        gap: 5,
    },
    bannerBadgeText: { color: '#e8546f', fontWeight: '900', fontSize: 12 },
    bannerTitle: { fontSize: 21, color: '#fff', fontWeight: '900', marginTop: 2 },
    bannerSubtitle: { color: '#ffe7ef', fontSize: 12, lineHeight: 17, marginTop: 2 },

    formField: {
        borderRadius: 18,
        backgroundColor: '#fff',
        padding: 14,
        gap: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.045,
        shadowRadius: 16,
        elevation: 2,
    },
    groupCard: {
        borderRadius: 22,
        backgroundColor: '#fff',
        padding: 14,
        gap: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.045,
        shadowRadius: 16,
        elevation: 2,
    },
    groupHeader: {
        gap: 3,
    },
    groupTitle: {
        color: '#0f172a',
        fontSize: 16,
        fontWeight: '900',
    },
    groupHint: {
        color: '#64748b',
        fontSize: 12,
        lineHeight: 17,
        fontWeight: '700',
    },
    groupFields: {
        gap: 10,
    },
    pickerField: {
        minHeight: 62,
        borderRadius: 16,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    pickerFieldIcon: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#fff1f5',
        alignItems: 'center',
        justifyContent: 'center',
    },
    pickerFieldValue: {
        color: '#0f172a',
        fontSize: 14,
        fontWeight: '800',
        marginTop: 3,
        textTransform: 'capitalize',
    },
    pickerFieldPlaceholder: {
        color: '#94a3b8',
    },
    inlineField: {
        minHeight: 62,
        borderRadius: 16,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    inlineFieldValue: {
        color: '#0f172a',
        fontSize: 14,
        fontWeight: '800',
        marginTop: 3,
    },
    inlineInput: {
        minHeight: 34,
        borderRadius: 0,
        color: '#0f172a',
        fontSize: 14,
        fontWeight: '800',
        paddingHorizontal: 0,
        paddingVertical: 0,
    },
    inputHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 1,
    },
    fieldLabel: {
        color: '#334155',
        fontSize: 12,
        fontWeight: '900',
        textTransform: 'uppercase',
    },
    textInput: {
        minHeight: 44,
        borderRadius: 14,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        color: '#0f172a',
        fontSize: 15,
        fontWeight: '700',
        paddingHorizontal: 12,
        paddingVertical: 10,
        textTransform: 'none',
    },
    textArea: {
        minHeight: 156,
        paddingTop: 12,
        lineHeight: 21,
        textAlignVertical: 'top',
    },
    readOnlyInput: {
        color: '#64748b',
        backgroundColor: '#f1f5f9',
    },
    charCounter: {
        fontSize: 11,
        color: '#94a3b8',
        textAlign: 'right',
        fontWeight: '700',
    },
    placeholder: {
        color: '#94a3b8',
        fontSize: 14,
        paddingHorizontal: 4,
        paddingVertical: 6,
        fontWeight: '700',
    },

    countBadge: { color: '#94a3b8', fontSize: 12, fontWeight: '800' },

    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 2 },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 5,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    chipSelected: { backgroundColor: '#e8546f', borderColor: '#e8546f' },
    chipText: { fontSize: 13, color: '#334155', fontWeight: '800' },
    chipTextSelected: { color: '#fff', fontWeight: '900' },
    chipRemove: { marginLeft: 2 },
    chipRemoveText: { fontSize: 16, color: '#999', lineHeight: 16 },

    promptCard: {
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 12,
        gap: 9,
        position: 'relative',
        backgroundColor: '#f8fafc',
    },
    promptRemove: { position: 'absolute', top: 8, right: 8, zIndex: 10 },
    promptQuestion: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', color: '#475569', paddingRight: 28 },
    promptAnswer: {
        minHeight: 92,
        backgroundColor: '#fff',
        textAlignVertical: 'top',
        lineHeight: 20,
        paddingTop: 12,
    },

    addPromptBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        minHeight: 48,
        borderRadius: 16,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: '#f9a8b8',
        backgroundColor: '#fff1f5',
    },
    addPromptText: { fontSize: 14, fontWeight: '900', color: '#e8546f' },

    sheetBody: {
        flex: 1,
        paddingHorizontal: 18,
        paddingTop: 12,
    },
    sheetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        gap: 12,
    },
    sheetCloseButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f1f5f9',
    },
    sheetScrollContent: {
        gap: 10,
        paddingBottom: 22,
    },
    sheetTitle: { fontSize: 20, fontWeight: '900', color: '#0f172a', marginBottom: 4 },
    promptSheetCard: {
        gap: 10,
        paddingTop: 4,
    },
    promptPickerCard: {
        borderRadius: 18,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 12,
        gap: 10,
    },
    promptSheetInput: {
        minHeight: 120,
        backgroundColor: '#f8fafc',
        textAlignVertical: 'top',
        lineHeight: 20,
        paddingTop: 12,
    },
    sheetSaveBtn: {
        alignSelf: 'flex-end',
        backgroundColor: '#e8546f',
        paddingHorizontal: 18,
        minHeight: 42,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sheetSaveBtnText: { color: '#fff', fontWeight: '900', fontSize: 14 },

    interestCategory: {
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 12,
        gap: 10,
    },
    interestCategoryTitle: {
        color: '#0f172a',
        fontSize: 15,
        fontWeight: '900',
    },
    pickerSectionCard: {
        borderRadius: 18,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 12,
        gap: 10,
    },
    pickerSectionTitle: {
        color: '#0f172a',
        fontSize: 15,
        fontWeight: '900',
    },
    pickerOptions: {
        gap: 8,
    },
    pickerOption: {
        minHeight: 50,
        borderRadius: 15,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
    },
    pickerOptionSelected: {
        backgroundColor: '#fff1f5',
        borderColor: '#f9a8b8',
    },
    pickerOptionText: {
        flex: 1,
        color: '#334155',
        fontSize: 14,
        fontWeight: '800',
        textTransform: 'capitalize',
    },
    pickerOptionTextSelected: {
        color: '#e8546f',
    },
});
