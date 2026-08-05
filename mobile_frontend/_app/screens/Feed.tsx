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
import { SafeImage } from '../funcs/customImage';
import { Skeleton, Loaderx, bottomsheet_renderBackdrop } from '../funcs/functions_stateful';
import { Toastx } from '../funcs/customNotification';
import { useTheme, ThemeColors } from '../funcs/theme';

type PickedMedia = { type: 'image' | 'video'; localUri: string; ext: string };

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

function FeedPostMedia({ item, imgDomain, style }: { item: { type: string; p: string }; imgDomain: string; style: any }) {
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
    const [composerMedia, setComposerMedia] = useState<PickedMedia | null>(null);
    const [isPosting, setIsPosting] = useState(false);
    const composerSheetRef = useRef<BottomSheet>(null);
    const composerSnapPoints = useMemo(() => ['70%'], []);
    const optionsSheetRef = useRef<BottomSheet>(null);
    const optionsSnapPoints = useMemo(() => ['32%'], []);

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
        const media = await mediaHandler.handleSelectFromGallery({ mediaType, selectionLimit: 1 });
        if (!media || media.length === 0) return;
        const asset = media[0];
        const localUri = asset?.uri ?? '';
        if (!localUri) return;
        const isVideo = (asset.type ?? '').startsWith('video');
        setComposerMedia({ type: isVideo ? 'video' : 'image', localUri, ext: getFileExtension(localUri) });
    }, []);

    const openComposer = useCallback((mode: 'text' | 'photo' | 'video') => {
        optionsSheetRef.current?.close();
        composerSheetRef.current?.expand();
        if (mode === 'photo' || mode === 'video') {
            handlePickMedia(mode);
        }
    }, [handlePickMedia]);

    const handleSubmitPost = useCallback(async () => {
        const caption = composerText.trim();
        if (!caption && !composerMedia) {
            Toastx.show({ type: 'error', message: 'Write something or attach a photo/video first.' });
            return;
        }

        setIsPosting(true);
        Loaderx.show();
        try {
            let media: { type: string; p: string }[] = [];

            if (composerMedia) {
                const bucketType = 'feed-media';
                const presigned = await uploadHandler.requestPresignedURL_Upload(composerMedia.ext, bucketType);
                const uploadFilePath = composerMedia.localUri.startsWith('file://')
                    ? composerMedia.localUri.replace('file://', '')
                    : composerMedia.localUri;
                const contentType = getMimeTypeFromExt(composerMedia.ext);

                const uploadResult = await RNFS.uploadFiles({
                    toUrl: presigned.uploadUrl,
                    files: [{
                        name: 'file',
                        filename: `feed_${Date.now()}.${composerMedia.ext}`,
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
                media = [{ type: composerMedia.type, p: uploadedPath }];
            }

            const response = await _http_request({
                reqType: 'POST',
                customApiUrl: __CONFIG__.HTTPS_API_DOMAIN + "/api/core/v1/pushFeedPost",
                bodyArray: { caption, media },
            });

            if (response?.code === 200) {
                setComposerText('');
                setComposerMedia(null);
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
                    <View style={stylesoy.card}>
                        <Pressable
                            style={stylesoy.cardHeader}
                            onPress={() => navigation.navigate(namer.navigation.peoplesOnePerson, { getOnePersonId: item.post_user_id })}
                        >
                            <SafeImage
                                style={stylesoy.avatar}
                                source={{ uri: imgDomain + (item.user_image?.[0]?.p ?? '') }}
                            />
                            <View style={{ flex: 1 }}>
                                <Text style={[stylesoy.name, { color: colors.text }]}>{item.user_fullname}</Text>
                                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{help.timeAgo(item.post_dateAdded)}</Text>
                            </View>
                        </Pressable>

                        {!!item.post_caption && (
                            <Text style={[stylesoy.caption, { color: colors.text }]}>{item.post_caption}</Text>
                        )}

                        {item.post_media?.[0] && (
                            <FeedPostMedia
                                item={item.post_media[0]}
                                imgDomain={imgDomain}
                                style={stylesoy.media}
                            />
                        )}

                        <View style={stylesoy.reactionsRow}>
                            <Pressable
                                style={stylesoy.reactionBtn}
                                onPress={() => handleLike(item)}
                            >
                                <IIcon
                                    name={item.viewer_has_liked ? 'heart' : 'heart-outline'}
                                    size={22}
                                    color={item.viewer_has_liked ? '#e11d48' : colors.textSecondary}
                                />
                                <Text style={{ color: colors.textSecondary }}>{item.like_count}</Text>
                            </Pressable>
                        </View>
                    </View>
                )}
                ListEmptyComponent={
                    <View style={{ paddingVertical: 40, alignItems: 'center', gap: 8 }}>
                        <MaterialCommunityIcons name="post-outline" size={34} color={colors.primary} />
                        <Text style={{ color: colors.textSecondary }}>No posts in your feed yet.</Text>
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
                ref={composerSheetRef}
                index={-1}
                enablePanDownToClose
                snapPoints={composerSnapPoints}
                backdropComponent={bottomsheet_renderBackdrop}
                keyboardBehavior="extend"
                keyboardBlurBehavior="restore"
            >
                <BottomSheetView style={{ padding: 16, flex: 1 }}>
                    <Text style={[stylesoy.composerTitle, { color: colors.text }]}>New Post</Text>
                    <TextInput
                        style={stylesoy.composerInput}
                        placeholder="Share something with everyone..."
                        placeholderTextColor={colors.textTertiary}
                        multiline
                        autoFocus
                        value={composerText}
                        onChangeText={setComposerText}
                    />
                    {composerMedia && (
                        <View style={{ marginTop: 8, position: 'relative' }}>
                            {composerMedia.type === 'video' ? (
                                <Video
                                    source={{ uri: composerMedia.localUri }}
                                    style={{ width: '100%', height: 180, borderRadius: 12, backgroundColor: colors.backgroundSecondary }}
                                    resizeMode="cover"
                                    muted
                                    paused
                                />
                            ) : (
                                <SafeImage
                                    style={{ width: '100%', height: 180, borderRadius: 12 }}
                                    source={{ uri: composerMedia.localUri }}
                                />
                            )}
                            <Pressable
                                style={stylesoy.removeMediaBtn}
                                onPress={() => setComposerMedia(null)}
                            >
                                <IIcon name="close" size={16} color="#fff" />
                            </Pressable>
                        </View>
                    )}
                    <View style={stylesoy.composerActions}>
                        <Pressable style={stylesoy.attachBtn} onPress={() => handlePickMedia()}>
                            <MaterialCommunityIcons name="image-multiple-outline" size={20} color={colors.accent} />
                            <Text style={{ color: colors.accent, fontWeight: '600' }}>Photo/Video</Text>
                        </Pressable>
                        <Pressable
                            style={[stylesoy.postBtn, { opacity: isPosting ? 0.6 : 1 }]}
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
            top: 8,
            right: 8,
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
