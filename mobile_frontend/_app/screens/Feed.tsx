import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, FlatList, TextInput, ActivityIndicator, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { _http_request, cacheStorage, help, logReport, mediaHandler, uploadHandler } from '../funcs/functions';
import { styles, namer, __CONFIG__ } from '../funcs/static';
import IIcon from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import RNFS from 'react-native-fs';
import Video from 'react-native-video';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { SafeImage } from '../funcs/customImage';
import { Skeleton, Loaderx, bottomsheet_renderBackdrop } from '../funcs/functions_stateful';
import { ActionBurstOverlay } from '../funcs/customCelebration';
import { Toastx } from '../funcs/customNotification';
import { useTheme, ThemeColors } from '../funcs/theme';

type PickedMedia = { type: 'image' | 'video'; localUri: string; ext: string };
type FeedMediaItem = { type: string; p: string };

const MAX_COMPOSER_MEDIA = 5;
const CAPTION_TRUNCATE_LENGTH = 150;

function getFileExtension(path: string): string {
    const cleaned = path.split('?')[0].split('#')[0];
    const parts = cleaned.split('.');
    if (parts.length < 2) return 'jpg';
    const ext = parts[parts.length - 1].toLowerCase().replace(/[^a-z0-9]/g, '');
    return ext || 'jpg';
}

function getMimeTypeFromExt(ext: string): string {
    const map: Record<string, string> = {
        jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp',
        mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska', avi: 'video/x-msvideo',
    };
    return map[ext] ?? 'application/octet-stream';
}

function FeedPostMedia({ item, imgDomain, style }: { item: FeedMediaItem; imgDomain: string; style: any }) {
    const uri = imgDomain + item.p;
    if (item.type === 'video') {
        return (
            <Video
                source={{ uri }}
                style={style}
                resizeMode="cover"
                repeat
                muted
                paused={false}
                controls={false}
            />
        );
    }
    return <SafeImage style={style} source={{ uri }} />;
}

/**
 * Pressable's own onPress-timestamp double-tap detection is unreliable over a
 * react-native-video view (the native player view can swallow the second touch),
 * so double-tap-to-like uses gesture-handler's native tap recognizer instead --
 * it composes correctly with the carousel's horizontal scroll gesture too.
 */
function DoubleTapArea({ onDoubleTap, style, children }: { onDoubleTap: () => void; style?: any; children: React.ReactNode }) {
    const doubleTap = Gesture.Tap()
        .numberOfTaps(2)
        .maxDelay(250)
        .onEnd((_e, success) => {
            if (success) runOnJS(onDoubleTap)();
        });

    return (
        <GestureDetector gesture={doubleTap}>
            <View style={style}>{children}</View>
        </GestureDetector>
    );
}

function FeedMediaCarousel({ media, imgDomain, style, onMediaPress }: {
    media: FeedMediaItem[]; imgDomain: string; style: any; onMediaPress: () => void;
}) {
    const [width, setWidth] = useState(0);
    const [index, setIndex] = useState(0);

    const onScroll = useCallback((e: any) => {
        if (!width) return;
        const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
        setIndex(newIndex);
    }, [width]);

    return (
        <View style={{ position: 'relative' }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
            {width > 0 && (
                <FlatList
                    data={media}
                    keyExtractor={(_, i) => String(i)}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onScroll={onScroll}
                    scrollEventThrottle={16}
                    getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
                    renderItem={({ item }) => (
                        <DoubleTapArea onDoubleTap={onMediaPress} style={{ width }}>
                            <FeedPostMedia item={item} imgDomain={imgDomain} style={style} />
                        </DoubleTapArea>
                    )}
                />
            )}
            {media.length > 1 && (
                <View style={carouselStyles.dotsRow} pointerEvents="none">
                    {media.map((_, i) => (
                        <View key={i} style={[carouselStyles.dot, i === index && carouselStyles.dotActive]} />
                    ))}
                </View>
            )}
        </View>
    );
}

function FeedPostCard({ item, imgDomain, colors, stylesoy, isMyTimeline, onPressProfile, onLike, onOpenMenu }: {
    item: any;
    imgDomain: string;
    colors: ThemeColors;
    stylesoy: ReturnType<typeof createStylesoy>;
    isMyTimeline: boolean;
    onPressProfile: () => void;
    onLike: (post: any) => void;
    onOpenMenu: (post: any) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const [burstKey, setBurstKey] = useState<number | null>(null);

    const handleMediaDoubleTap = useCallback(() => {
        if (!isMyTimeline && !item.viewer_has_liked) onLike(item);
        setBurstKey(Date.now());
    }, [item, isMyTimeline, onLike]);

    const captionIsLong = (item.post_caption?.length ?? 0) > CAPTION_TRUNCATE_LENGTH;
    const media: FeedMediaItem[] = item.post_media ?? [];

    return (
        <View style={stylesoy.card}>
            <View style={stylesoy.cardHeader}>
                <Pressable style={stylesoy.cardHeaderProfile} onPress={onPressProfile}>
                    <SafeImage
                        style={stylesoy.avatar}
                        source={{ uri: imgDomain + (item.user_image?.[0]?.p ?? '') }}
                    />
                    <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Text style={[stylesoy.name, { color: colors.text }]}>{item.user_fullname}</Text>
                            {item.user_verified === 1 && (
                                <IIcon name="checkmark-done-circle-sharp" size={15} color={colors.accent} />
                            )}
                        </View>
                        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{help.timeAgo(item.post_dateAdded)}</Text>
                    </View>
                </Pressable>
                <Pressable style={stylesoy.menuBtn} hitSlop={8} onPress={() => onOpenMenu(item)}>
                    <IIcon name="ellipsis-horizontal" size={20} color={colors.textSecondary} />
                </Pressable>
            </View>

            {!!item.post_caption && (
                <View>
                    <Text style={[stylesoy.caption, { color: colors.text }]} numberOfLines={expanded ? undefined : 4}>
                        {item.post_caption}
                    </Text>
                    {captionIsLong && (
                        <Pressable onPress={() => setExpanded((e) => !e)}>
                            <Text style={{ color: colors.accent, fontWeight: '600', marginTop: 2 }}>
                                {expanded ? 'See less' : 'See more'}
                            </Text>
                        </Pressable>
                    )}
                </View>
            )}

            {media.length > 0 && (
                <View style={{ position: 'relative' }}>
                    {media.length > 1 ? (
                        <FeedMediaCarousel media={media} imgDomain={imgDomain} style={stylesoy.media} onMediaPress={handleMediaDoubleTap} />
                    ) : (
                        <DoubleTapArea onDoubleTap={handleMediaDoubleTap}>
                            <FeedPostMedia item={media[0]} imgDomain={imgDomain} style={stylesoy.media} />
                        </DoubleTapArea>
                    )}
                    {burstKey !== null && (
                        <ActionBurstOverlay burst={{ kind: 'like', key: burstKey }} onDone={() => setBurstKey(null)} />
                    )}
                </View>
            )}

            {isMyTimeline ? (
                <View style={stylesoy.reactionsRow}>
                    <IIcon name="heart" size={18} color="#e11d48" />
                    <Text style={{ color: colors.textSecondary }}>
                        {item.like_count} {item.like_count === 1 ? 'like' : 'likes'}
                    </Text>
                </View>
            ) : (
                <View style={stylesoy.reactionsRow}>
                    <Pressable style={stylesoy.reactionBtn} onPress={() => onLike(item)}>
                        <IIcon
                            name={item.viewer_has_liked ? 'heart' : 'heart-outline'}
                            size={22}
                            color={item.viewer_has_liked ? '#e11d48' : colors.textSecondary}
                        />
                        <Text style={{ color: colors.textSecondary }}>{item.like_count}</Text>
                    </Pressable>
                </View>
            )}
        </View>
    );
}

export function Screen_feed({ navigation, route }: { navigation: any; route?: any }) {
    const { colors } = useTheme();
    const stylesoy = useMemoStyles(colors);
    const __MAPPER = cacheStorage.CONFIG.get()?.mapper;
    const imgDomain = __MAPPER?.img_domain?.[0] ?? '';
    const isMyTimeline = Boolean(route?.params?.onlyMine);

    const [feedPosts, setFeedPosts] = useState<any[] | null>(null);
    const [nextCursor, setNextCursor] = useState<number | null>(null);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const [composerText, setComposerText] = useState('');
    const [composerMedia, setComposerMedia] = useState<PickedMedia[]>([]);
    const [isPosting, setIsPosting] = useState(false);
    const composerSheetRef = useRef<BottomSheet>(null);
    const composerInputRef = useRef<TextInput>(null);
    const composerSnapPoints = useMemo(() => ['70%'], []);
    const optionsSheetRef = useRef<BottomSheet>(null);
    const optionsSnapPoints = useMemo(() => ['32%'], []);
    const postMenuSheetRef = useRef<BottomSheet>(null);
    const postMenuSnapPoints = useMemo(() => ['24%'], []);
    const [menuPost, setMenuPost] = useState<any | null>(null);

    const fetchFeed = useCallback(async (cursor?: number | null) => {
        const response = await _http_request({
            reqType: 'POST',
            customApiUrl: __CONFIG__.HTTPS_API_DOMAIN + "/api/core/v1/getFeed",
            bodyArray: { ...(cursor ? { cursor } : {}), ...(isMyTimeline ? { onlyMine: true } : {}) },
        });
        if (response?.code !== 200) return null;
        return response;
    }, [isMyTimeline]);

    useFocusEffect(useCallback(() => {
        if (feedPosts !== null) return;
        (async () => {
            const response = await fetchFeed();
            setFeedPosts(response?.feedPosts ?? []);
            setNextCursor(response?.nextCursor ?? null);
        })();
    }, [feedPosts, fetchFeed]));

    const handleRefresh = useCallback(async () => {
        setIsRefreshing(true);
        const response = await fetchFeed();
        setFeedPosts(response?.feedPosts ?? []);
        setNextCursor(response?.nextCursor ?? null);
        setIsRefreshing(false);
    }, [fetchFeed]);

    const handleEndReached = useCallback(async () => {
        if (!nextCursor || isLoadingMore) return;
        setIsLoadingMore(true);
        const response = await fetchFeed(nextCursor);
        if (response?.feedPosts?.length) {
            setFeedPosts((prev) => [...(prev ?? []), ...response.feedPosts]);
        }
        setNextCursor(response?.nextCursor ?? null);
        setIsLoadingMore(false);
    }, [nextCursor, isLoadingMore, fetchFeed]);

    const handlePickMedia = useCallback(async (mediaType: 'photo' | 'video' | 'mixed' = 'mixed') => {
        const remaining = MAX_COMPOSER_MEDIA - composerMedia.length;
        if (remaining <= 0) {
            Toastx.show({ type: 'info', message: `You can attach up to ${MAX_COMPOSER_MEDIA} items.` });
            return;
        }
        const media = await mediaHandler.handleSelectFromGallery({ mediaType, selectionLimit: remaining });
        if (!media || media.length === 0) return;
        const picked: PickedMedia[] = media
            .map((asset) => {
                const localUri = asset?.uri ?? '';
                const isVideo = (asset.type ?? '').startsWith('video');
                return { type: isVideo ? 'video' : 'image', localUri, ext: getFileExtension(localUri) } as PickedMedia;
            })
            .filter((m) => !!m.localUri);
        setComposerMedia((prev) => [...prev, ...picked].slice(0, MAX_COMPOSER_MEDIA));
    }, [composerMedia.length]);

    const openComposer = useCallback((mode: 'text' | 'photo' | 'video') => {
        optionsSheetRef.current?.close();
        composerSheetRef.current?.expand();
        if (mode === 'photo' || mode === 'video') {
            handlePickMedia(mode);
        }
    }, [handlePickMedia]);

    const handleSubmitPost = useCallback(async () => {
        const caption = composerText.trim();
        if (!caption && composerMedia.length === 0) {
            Toastx.show({ type: 'error', message: 'Write something or attach a photo/video first.' });
            return;
        }

        setIsPosting(true);
        Loaderx.show();
        try {
            const media = await Promise.all(composerMedia.map(async (item, idx) => {
                const bucketType = 'feed-media';
                const presigned = await uploadHandler.requestPresignedURL_Upload(item.ext, bucketType);
                const uploadFilePath = item.localUri.startsWith('file://')
                    ? item.localUri.replace('file://', '')
                    : item.localUri;
                const contentType = getMimeTypeFromExt(item.ext);

                const uploadResult = await RNFS.uploadFiles({
                    toUrl: presigned.uploadUrl,
                    files: [{
                        name: 'file',
                        filename: `feed_${Date.now()}_${idx}.${item.ext}`,
                        filepath: uploadFilePath,
                        filetype: contentType,
                    }],
                    method: presigned.method || 'PUT',
                    headers: { 'Content-Type': contentType },
                    binaryStreamOnly: true,
                }).promise;

                if (uploadResult.statusCode < 200 || uploadResult.statusCode >= 300) {
                    throw new Error('Media upload failed.');
                }

                const uploadedPath = "/" + uploadHandler.joinPath(presigned.bucket, presigned.fileKey);
                return { type: item.type, p: uploadedPath };
            }));

            const response = await _http_request({
                reqType: 'POST',
                customApiUrl: __CONFIG__.HTTPS_API_DOMAIN + "/api/core/v1/pushFeedPost",
                bodyArray: { caption, media },
            });

            if (response?.code === 200) {
                setComposerText('');
                setComposerMedia([]);
                composerSheetRef.current?.close();
                await handleRefresh();
                Toastx.show({ type: 'success', message: 'Posted!' });
            } else {
                Toastx.show({ type: 'error', message: response?.message ?? 'Unable to post right now.' });
            }
        } catch (error: any) {
            logReport({ type: 'function', extra: error?.message, useraction: 'pushFeedPost', logMessage: error?.message, stackTrace: error });
            Toastx.show({ type: 'error', message: error?.message ?? 'Unable to post right now.' });
        } finally {
            setIsPosting(false);
            Loaderx.hide();
        }
    }, [composerText, composerMedia, handleRefresh]);

    const handleLike = useCallback(async (post: any) => {
        const wasLiked = Boolean(post.viewer_has_liked);
        const nextLiked = !wasLiked;
        setFeedPosts((prev) => (prev ?? []).map((p) => (
            p.post_id === post.post_id
                ? { ...p, viewer_has_liked: nextLiked, like_count: p.like_count + (nextLiked ? 1 : -1) }
                : p
        )));
        const response = await _http_request({
            reqType: 'POST',
            customApiUrl: __CONFIG__.HTTPS_API_DOMAIN + "/api/core/v1/pushFeedReaction",
            bodyArray: { post_id: post.post_id, reaction: nextLiked ? 'like' : 'unlike' },
        });
        if (response?.code !== 200) {
            // revert on failure
            setFeedPosts((prev) => (prev ?? []).map((p) => (
                p.post_id === post.post_id
                    ? { ...p, viewer_has_liked: wasLiked, like_count: p.like_count + (wasLiked ? 1 : -1) }
                    : p
            )));
            Toastx.show({ type: 'error', message: response?.message ?? 'Unable to update your like.' });
        }
    }, []);

    const handleDeletePost = useCallback(async (post: any) => {
        setFeedPosts((prev) => (prev ?? []).filter((p) => p.post_id !== post.post_id));
        const response = await _http_request({
            reqType: 'POST',
            customApiUrl: __CONFIG__.HTTPS_API_DOMAIN + "/api/core/v1/pushDeleteFeedPost",
            bodyArray: { post_id: post.post_id },
        });
        if (response?.code === 200) {
            Toastx.show({ type: 'success', message: 'Post deleted.' });
        } else {
            setFeedPosts((prev) => [post, ...(prev ?? [])]);
            Toastx.show({ type: 'error', message: response?.message ?? 'Unable to delete post.' });
        }
    }, []);

    const handleReportPost = useCallback((post: any) => {
        logReport({
            type: 'reportfeedpost',
            useraction: 'reporting feed post',
            logMessage: 'Reported from the feed 3-dot menu.',
            reporteduserId: post.post_user_id,
            reportedPostId: post.post_id,
        });
        Toastx.show({ type: 'success', message: 'Post reported. Thanks for letting us know.' });
    }, []);

    const handleOpenPostMenu = useCallback((post: any) => {
        setMenuPost(post);
        postMenuSheetRef.current?.expand();
    }, []);

    useLayoutEffect(() => {
        navigation.setOptions({
            title: isMyTimeline ? 'My Posts' : 'Feed',
            headerRight: isMyTimeline ? undefined : () => (
                <Pressable
                    style={stylesoy.headerButton}
                    onPress={() => navigation.navigate(namer.navigation.myTimeline, { onlyMine: true })}
                >
                    <IIcon name="person-circle-outline" size={26} color={colors.text} />
                </Pressable>
            ),
        });
    }, [navigation, colors, stylesoy, isMyTimeline]);

    if (feedPosts === null) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background, padding: 12 }]}>
                <Skeleton style={{ height: 90, borderRadius: 16, marginBottom: 12 }} />
                {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} style={{ height: 260, borderRadius: 16, marginBottom: 12 }} />
                ))}
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <FlatList
                data={feedPosts}
                keyExtractor={(item) => item.post_id}
                onEndReached={handleEndReached}
                onEndReachedThreshold={0.3}
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ padding: 12, gap: 12 }}
                renderItem={({ item }) => (
                    <FeedPostCard
                        item={item}
                        imgDomain={imgDomain}
                        colors={colors}
                        stylesoy={stylesoy}
                        isMyTimeline={isMyTimeline}
                        onPressProfile={() => navigation.navigate(namer.navigation.peoplesOnePerson, { getOnePersonId: item.post_user_id })}
                        onLike={handleLike}
                        onOpenMenu={handleOpenPostMenu}
                    />
                )}
                ListEmptyComponent={
                    <View style={{ paddingVertical: 40, alignItems: 'center', gap: 8 }}>
                        <MaterialCommunityIcons name="post-outline" size={34} color={colors.primary} />
                        <Text style={{ color: colors.textSecondary }}>
                            {isMyTimeline ? "You haven't posted anything yet." : 'No posts in your feed yet.'}
                        </Text>
                    </View>
                }
                ListFooterComponent={isLoadingMore ? (
                    <View style={{ alignItems: 'center', paddingVertical: 12 }}>
                        <ActivityIndicator size="small" color={colors.accent} />
                    </View>
                ) : null}
            />

            <Pressable
                style={stylesoy.fab}
                onPress={() => optionsSheetRef.current?.expand()}
            >
                <IIcon name="add" size={30} color="#fff" />
            </Pressable>

            <BottomSheet
                ref={optionsSheetRef}
                index={-1}
                enablePanDownToClose
                snapPoints={optionsSnapPoints}
                backdropComponent={bottomsheet_renderBackdrop}
            >
                <BottomSheetView style={{ padding: 16 }}>
                    <Text style={[stylesoy.composerTitle, { color: colors.text }]}>New Post</Text>
                    <Pressable style={stylesoy.optionRow} onPress={() => openComposer('text')}>
                        <View style={stylesoy.optionIconWrap}>
                            <MaterialCommunityIcons name="text" size={22} color={colors.accent} />
                        </View>
                        <Text style={[stylesoy.optionLabel, { color: colors.text }]}>Text</Text>
                    </Pressable>
                    <Pressable style={stylesoy.optionRow} onPress={() => openComposer('photo')}>
                        <View style={stylesoy.optionIconWrap}>
                            <MaterialCommunityIcons name="image-outline" size={22} color={colors.accent} />
                        </View>
                        <Text style={[stylesoy.optionLabel, { color: colors.text }]}>Photo</Text>
                    </Pressable>
                    <Pressable style={stylesoy.optionRow} onPress={() => openComposer('video')}>
                        <View style={stylesoy.optionIconWrap}>
                            <MaterialCommunityIcons name="video-outline" size={22} color={colors.accent} />
                        </View>
                        <Text style={[stylesoy.optionLabel, { color: colors.text }]}>Video</Text>
                    </Pressable>
                </BottomSheetView>
            </BottomSheet>

            <BottomSheet
                ref={postMenuSheetRef}
                index={-1}
                enablePanDownToClose
                snapPoints={postMenuSnapPoints}
                backdropComponent={bottomsheet_renderBackdrop}
                onClose={() => setMenuPost(null)}
            >
                <BottomSheetView style={{ padding: 16 }}>
                    {isMyTimeline ? (
                        <Pressable
                            style={stylesoy.optionRow}
                            onPress={() => {
                                postMenuSheetRef.current?.close();
                                if (menuPost) handleDeletePost(menuPost);
                            }}
                        >
                            <View style={[stylesoy.optionIconWrap, stylesoy.optionIconWrapDanger]}>
                                <IIcon name="trash-outline" size={20} color="#e11d48" />
                            </View>
                            <Text style={[stylesoy.optionLabel, { color: '#e11d48' }]}>Delete Post</Text>
                        </Pressable>
                    ) : (
                        <Pressable
                            style={stylesoy.optionRow}
                            onPress={() => {
                                postMenuSheetRef.current?.close();
                                if (menuPost) handleReportPost(menuPost);
                            }}
                        >
                            <View style={[stylesoy.optionIconWrap, stylesoy.optionIconWrapDanger]}>
                                <IIcon name="flag-outline" size={20} color="#e11d48" />
                            </View>
                            <Text style={[stylesoy.optionLabel, { color: '#e11d48' }]}>Report Post</Text>
                        </Pressable>
                    )}
                </BottomSheetView>
            </BottomSheet>

            <BottomSheet
                ref={composerSheetRef}
                index={-1}
                enablePanDownToClose
                snapPoints={composerSnapPoints}
                backdropComponent={bottomsheet_renderBackdrop}
                keyboardBehavior="extend"
                keyboardBlurBehavior="restore"
                onChange={(sheetIndex) => {
                    if (sheetIndex === 0) composerInputRef.current?.focus();
                }}
            >
                <BottomSheetView style={{ padding: 16, flex: 1 }}>
                    <Text style={[stylesoy.composerTitle, { color: colors.text }]}>New Post</Text>
                    <TextInput
                        ref={composerInputRef}
                        style={stylesoy.composerInput}
                        placeholder="Share something with everyone..."
                        placeholderTextColor={colors.textTertiary}
                        multiline
                        value={composerText}
                        onChangeText={setComposerText}
                    />
                    {composerMedia.length > 0 && (
                        <View style={stylesoy.composerThumbRow}>
                            {composerMedia.map((m, idx) => (
                                <View key={idx} style={{ position: 'relative' }}>
                                    {m.type === 'video' ? (
                                        <Video source={{ uri: m.localUri }} style={stylesoy.composerThumb} resizeMode="cover" muted paused />
                                    ) : (
                                        <SafeImage style={stylesoy.composerThumb} source={{ uri: m.localUri }} />
                                    )}
                                    <Pressable
                                        style={stylesoy.removeMediaBtn}
                                        onPress={() => setComposerMedia((prev) => prev.filter((_, i) => i !== idx))}
                                    >
                                        <IIcon name="close" size={14} color="#fff" />
                                    </Pressable>
                                </View>
                            ))}
                            {composerMedia.length < MAX_COMPOSER_MEDIA && (
                                <Pressable style={stylesoy.addMoreThumb} onPress={() => handlePickMedia()}>
                                    <IIcon name="add" size={24} color={colors.accent} />
                                </Pressable>
                            )}
                        </View>
                    )}
                    <View style={stylesoy.composerActions}>
                        {composerMedia.length === 0 && (
                            <Pressable style={stylesoy.attachBtn} onPress={() => handlePickMedia()}>
                                <MaterialCommunityIcons name="image-multiple-outline" size={20} color={colors.accent} />
                                <Text style={{ color: colors.accent, fontWeight: '600' }}>Photo/Video</Text>
                            </Pressable>
                        )}
                        <Pressable
                            style={[stylesoy.postBtn, { opacity: isPosting ? 0.6 : 1, marginLeft: 'auto' }]}
                            disabled={isPosting}
                            onPress={handleSubmitPost}
                        >
                            <Text style={{ color: '#fff', fontWeight: '700' }}>Post</Text>
                        </Pressable>
                    </View>
                </BottomSheetView>
            </BottomSheet>
        </View>
    );
}

function useMemoStyles(colors: ThemeColors) {
    return React.useMemo(() => createStylesoy(colors), [colors]);
}

const carouselStyles = StyleSheet.create({
    dotsRow: {
        position: 'absolute',
        bottom: 10,
        alignSelf: 'center',
        flexDirection: 'row',
        gap: 6,
        backgroundColor: 'rgba(0,0,0,0.3)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
    },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
    dotActive: { backgroundColor: '#fff' },
});

function createStylesoy(colors: ThemeColors) {
    return StyleSheet.create({
        headerButton: {
            width: 30,
            height: 30,
            borderRadius: 15,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 8,
        },
        fab: {
            position: 'absolute',
            right: 20,
            bottom: 24,
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: colors.accent,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: colors.shadow,
            shadowOpacity: 0.25,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
            elevation: 8,
        },
        composerTitle: {
            fontSize: 17,
            fontWeight: '700',
            marginBottom: 10,
        },
        optionRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            paddingVertical: 12,
        },
        optionIconWrap: {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.backgroundSecondary,
            alignItems: 'center',
            justifyContent: 'center',
        },
        optionIconWrapDanger: {
            backgroundColor: 'rgba(225,29,72,0.12)',
        },
        optionLabel: {
            fontSize: 15,
            fontWeight: '600',
        },
        composerInput: {
            minHeight: 44,
            color: colors.text,
            fontSize: 15,
        },
        composerActions: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 10,
        },
        composerThumbRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            marginTop: 8,
        },
        composerThumb: {
            width: 84,
            height: 84,
            borderRadius: 10,
            backgroundColor: colors.backgroundSecondary,
        },
        addMoreThumb: {
            width: 84,
            height: 84,
            borderRadius: 10,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
        },
        attachBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
        },
        postBtn: {
            backgroundColor: colors.accent,
            paddingVertical: 8,
            paddingHorizontal: 18,
            borderRadius: 10,
        },
        removeMediaBtn: {
            position: 'absolute',
            top: 4,
            right: 4,
            backgroundColor: 'rgba(0,0,0,0.55)',
            borderRadius: 12,
            padding: 4,
        },
        card: {
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 12,
            gap: 10,
        },
        cardHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
        },
        cardHeaderProfile: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
        },
        menuBtn: {
            width: 28,
            height: 28,
            alignItems: 'center',
            justifyContent: 'center',
        },
        avatar: {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.backgroundSecondary,
        },
        name: {
            fontWeight: '700',
            fontSize: 14,
        },
        caption: {
            fontSize: 14,
            lineHeight: 20,
        },
        media: {
            width: '100%',
            height: 320,
            borderRadius: 12,
            backgroundColor: colors.backgroundSecondary,
        },
        reactionsRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 20,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
            paddingTop: 10,
        },
        reactionBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
        },
    });
}
