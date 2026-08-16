import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  Modal,
} from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import {
  _http_request,
  cacheStorage,
  help,
  logReport,
  mediaHandler,
  reportUser,
  screenWidth,
  uploadHandler,
} from '../funcs/functions';
import { styles, namer, __CONFIG__ } from '../funcs/static';
import IIcon from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import RNFS from 'react-native-fs';
import Video from 'react-native-video';
import BottomSheet, {
  BottomSheetFlatList,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { SafeImage } from '../funcs/customImage';
import {
  Skeleton,
  Loaderx,
  bottomsheet_renderBackdrop,
} from '../funcs/functions_stateful';
import { ActionBurstOverlay } from '../funcs/customCelebration';
import { Toastx } from '../funcs/customNotification';
import { useTheme, ThemeColors } from '../funcs/theme';

type PickedMedia = {
  type: 'image' | 'video';
  localUri: string;
  ext: string;
  width?: number;
  height?: number;
};
type FeedMediaItem = { type: string; p: string; w?: number; h?: number };
type ReactionKind = 'like' | 'love' | 'haha' | 'wow' | 'celebrate' | 'support';

const MAX_COMPOSER_MEDIA = 5;
const CAPTION_TRUNCATE_LENGTH = 150;
const FEED_POLL_INTERVAL_MS = 30000;
const NEAR_TOP_THRESHOLD = 100;

const REACTIONS: { key: ReactionKind; emoji: string; label: string }[] = [
  { key: 'like', emoji: '❤️', label: 'Like' },
  { key: 'love', emoji: '😍', label: 'Love' },
  { key: 'haha', emoji: '😂', label: 'Haha' },
  { key: 'wow', emoji: '😮', label: 'Wow' },
  { key: 'celebrate', emoji: '🎉', label: 'Celebrate' },
  { key: 'support', emoji: '🤝', label: 'Support' },
];
const REACTIONS_BY_KEY: Record<
  string,
  { key: ReactionKind; emoji: string; label: string }
> = Object.fromEntries(REACTIONS.map(r => [r.key, r]));

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
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    webm: 'video/webm',
    mkv: 'video/x-matroska',
    avi: 'video/x-msvideo',
  };
  return map[ext] ?? 'application/octet-stream';
}

/** Instagram-style clamp so an extreme source aspect ratio never dominates the feed. */
function computeMediaAspectRatio(media: FeedMediaItem[]): number {
  const first = media[0];
  if (first?.w && first?.h) {
    return Math.min(1.91, Math.max(0.8, first.w / first.h));
  }
  return 1;
}

function FeedPostMedia({
  item,
  imgDomain,
  style,
  isActive = true,
}: {
  item: FeedMediaItem;
  imgDomain: string;
  style: any;
  isActive?: boolean;
}) {
  const uri = imgDomain + item.p;
  if (item.type === 'video') {
    return (
      <Video
        source={{ uri }}
        style={style}
        resizeMode="cover"
        repeat
        muted
        paused={!isActive}
        controls={false}
      />
    );
  }
  return <SafeImage style={style} source={{ uri }} />;
}

/**
 * Single tap opens the fullscreen viewer, double tap reacts -- gesture-handler's
 * Exclusive+requireExternalGestureToFail is the standard idiom for disambiguating
 * the two without a native Pressable's unreliable timestamp guessing (which also
 * doesn't play well with a react-native-video view swallowing touches).
 */
function MediaTapArea({
  onSingleTap,
  onDoubleTap,
  style,
  children,
}: {
  onSingleTap: () => void;
  onDoubleTap: () => void;
  style?: any;
  children: React.ReactNode;
}) {
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(250)
    .onEnd((_e, success) => {
      if (success) runOnJS(onDoubleTap)();
    });
  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .maxDelay(250)
    .requireExternalGestureToFail(doubleTap)
    .onEnd((_e, success) => {
      if (success) runOnJS(onSingleTap)();
    });
  const composed = Gesture.Exclusive(doubleTap, singleTap);

  return (
    <GestureDetector gesture={composed}>
      <View style={style}>{children}</View>
    </GestureDetector>
  );
}

function FeedMediaCarousel({
  media,
  imgDomain,
  style,
  isActive,
  onMediaDoubleTap,
  onOpenFullscreen,
}: {
  media: FeedMediaItem[];
  imgDomain: string;
  style: any;
  isActive: boolean;
  onMediaDoubleTap: () => void;
  onOpenFullscreen: (index: number) => void;
}) {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);

  const onScroll = useCallback(
    (e: any) => {
      if (!width) return;
      const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
      setIndex(newIndex);
    },
    [width],
  );

  return (
    <View
      style={{ position: 'relative' }}
      onLayout={e => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 && (
        <FlatList
          data={media}
          keyExtractor={(_, i) => String(i)}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          getItemLayout={(_, i) => ({
            length: width,
            offset: width * i,
            index: i,
          })}
          renderItem={({ item, index: slideIndex }) => (
            <MediaTapArea
              style={{ width }}
              onSingleTap={() => onOpenFullscreen(slideIndex)}
              onDoubleTap={onMediaDoubleTap}
            >
              <FeedPostMedia
                item={item}
                imgDomain={imgDomain}
                style={style}
                isActive={isActive && slideIndex === index}
              />
            </MediaTapArea>
          )}
        />
      )}
      {media.length > 1 && (
        <>
          <View style={carouselStyles.counterPill} pointerEvents="none">
            <Text style={carouselStyles.counterText}>
              {index + 1}/{media.length}
            </Text>
          </View>
          <View style={carouselStyles.dotsRow} pointerEvents="none">
            {media.map((_, i) => (
              <View
                key={i}
                style={[
                  carouselStyles.dot,
                  i === index && carouselStyles.dotActive,
                ]}
              />
            ))}
          </View>
        </>
      )}
    </View>
  );
}

function ReactionButton({
  item,
  isMyTimeline,
  colors,
  stylesoy,
  onReact,
}: {
  item: any;
  isMyTimeline: boolean;
  colors: ThemeColors;
  stylesoy: ReturnType<typeof createStylesoy>;
  onReact: (post: any, kind: ReactionKind | 'remove') => void;
}) {
  const buttonRef = useRef<View>(null);
  const [pickerAnchor, setPickerAnchor] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const openPicker = useCallback(() => {
    buttonRef.current?.measureInWindow((x, y, _w, h) => {
      setPickerAnchor({ x, y: y + h });
    });
  }, []);

  const quickToggle = useCallback(() => {
    onReact(item, item.viewer_reaction ? 'remove' : 'like');
  }, [item, onReact]);

  const tapGesture = Gesture.Tap().onEnd((_e, success) => {
    if (success) runOnJS(quickToggle)();
  });
  const longPressGesture = Gesture.LongPress()
    .minDuration(350)
    .onStart(() => {
      runOnJS(openPicker)();
    });
  const reactionGesture = Gesture.Race(longPressGesture, tapGesture);

  const currentReaction = REACTIONS_BY_KEY[item.viewer_reaction];

  if (isMyTimeline) {
    return (
      <View style={stylesoy.reactionBtn}>
        <Text style={{ fontSize: 16 }}>{currentReaction?.emoji ?? '❤️'}</Text>
        <Text style={{ color: colors.textSecondary }}>
          {item.reaction_count}
        </Text>
      </View>
    );
  }

  return (
    <>
      <GestureDetector gesture={reactionGesture}>
        <View ref={buttonRef} collapsable={false} style={stylesoy.reactionBtn}>
          {currentReaction ? (
            <Text style={{ fontSize: 20 }}>{currentReaction.emoji}</Text>
          ) : (
            <IIcon
              name="heart-outline"
              size={22}
              color={colors.textSecondary}
            />
          )}
          <Text
            style={{
              color: item.viewer_reaction ? colors.text : colors.textSecondary,
              fontWeight: item.viewer_reaction ? '700' : '400',
            }}
          >
            {item.reaction_count}
          </Text>
        </View>
      </GestureDetector>

      <Modal
        transparent
        visible={!!pickerAnchor}
        animationType="fade"
        onRequestClose={() => setPickerAnchor(null)}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => setPickerAnchor(null)}
        >
          {pickerAnchor && (
            <View
              style={[
                stylesoy.reactionPickerRow,
                {
                  left: Math.max(8, pickerAnchor.x - 20),
                  top: Math.max(40, pickerAnchor.y - 66),
                },
              ]}
            >
              {REACTIONS.map(r => (
                <Pressable
                  key={r.key}
                  style={stylesoy.reactionPickerItem}
                  onPress={() => {
                    onReact(item, r.key);
                    setPickerAnchor(null);
                  }}
                >
                  <Text style={{ fontSize: 26 }}>{r.emoji}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </Pressable>
      </Modal>
    </>
  );
}

function FeedPostCard({
  item,
  imgDomain,
  colors,
  stylesoy,
  isMyTimeline,
  isActive,
  onPressProfile,
  onReact,
  onOpenMenu,
  onOpenComments,
  onOpenFullscreen,
}: {
  item: any;
  imgDomain: string;
  colors: ThemeColors;
  stylesoy: ReturnType<typeof createStylesoy>;
  isMyTimeline: boolean;
  isActive: boolean;
  onPressProfile: () => void;
  onReact: (post: any, kind: ReactionKind | 'remove') => void;
  onOpenMenu: (post: any) => void;
  onOpenComments: (post: any) => void;
  onOpenFullscreen: (media: FeedMediaItem[], index: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [burstKey, setBurstKey] = useState<number | null>(null);

  const media: FeedMediaItem[] = useMemo(
    () => item.post_media ?? [],
    [item.post_media],
  );
  const mediaAspectRatio = useMemo(
    () => computeMediaAspectRatio(media),
    [media],
  );
  const mediaStyle = useMemo(
    () => [stylesoy.media, { aspectRatio: mediaAspectRatio }],
    [stylesoy, mediaAspectRatio],
  );

  const handleMediaDoubleTap = useCallback(() => {
    if (!isMyTimeline && !item.viewer_reaction) onReact(item, 'like');
    setBurstKey(Date.now());
  }, [item, isMyTimeline, onReact]);

  const handleOpenFullscreen = useCallback(
    (index: number) => {
      onOpenFullscreen(media, index);
    },
    [media, onOpenFullscreen],
  );

  const captionIsLong =
    (item.post_caption?.length ?? 0) > CAPTION_TRUNCATE_LENGTH;

  return (
    <View style={stylesoy.card}>
      <View style={stylesoy.cardHeader}>
        <Pressable style={stylesoy.cardHeaderProfile} onPress={onPressProfile}>
          <SafeImage
            style={stylesoy.avatar}
            source={{ uri: imgDomain + (item.user_image?.[0]?.p ?? '') }}
          />
          <View style={{ flex: 1 }}>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Text style={[stylesoy.name, { color: colors.text }]}>
                {item.user_fullname}
              </Text>
              {item.user_verified === 1 && (
                <IIcon
                  name="checkmark-done-circle-sharp"
                  size={15}
                  color={colors.accent}
                />
              )}
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              {help.timeAgo(item.post_dateAdded)}
            </Text>
          </View>
        </Pressable>
        <Pressable
          style={stylesoy.menuBtn}
          hitSlop={8}
          onPress={() => onOpenMenu(item)}
        >
          <IIcon
            name="ellipsis-horizontal"
            size={20}
            color={colors.textSecondary}
          />
        </Pressable>
      </View>

      {!!item.post_caption && (
        <View>
          <Text
            style={[stylesoy.caption, { color: colors.text }]}
            numberOfLines={expanded ? undefined : 4}
          >
            {item.post_caption}
          </Text>
          {captionIsLong && (
            <Pressable onPress={() => setExpanded(e => !e)}>
              <Text
                style={{
                  color: colors.accent,
                  fontWeight: '600',
                  marginTop: 2,
                }}
              >
                {expanded ? 'See less' : 'See more'}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {media.length > 0 && (
        <View style={{ position: 'relative' }}>
          {media.length > 1 ? (
            <FeedMediaCarousel
              media={media}
              imgDomain={imgDomain}
              style={mediaStyle}
              isActive={isActive}
              onMediaDoubleTap={handleMediaDoubleTap}
              onOpenFullscreen={handleOpenFullscreen}
            />
          ) : (
            <MediaTapArea
              onSingleTap={() => handleOpenFullscreen(0)}
              onDoubleTap={handleMediaDoubleTap}
            >
              <FeedPostMedia
                item={media[0]}
                imgDomain={imgDomain}
                style={mediaStyle}
                isActive={isActive}
              />
            </MediaTapArea>
          )}
          {burstKey !== null && (
            <ActionBurstOverlay
              burst={{ kind: 'like', key: burstKey }}
              onDone={() => setBurstKey(null)}
            />
          )}
        </View>
      )}

      <View style={stylesoy.reactionsRow}>
        <ReactionButton
          item={item}
          isMyTimeline={isMyTimeline}
          colors={colors}
          stylesoy={stylesoy}
          onReact={onReact}
        />
        <Pressable
          style={stylesoy.reactionBtn}
          onPress={() => onOpenComments(item)}
        >
          <IIcon
            name="chatbubble-outline"
            size={19}
            color={colors.textSecondary}
          />
          <Text style={{ color: colors.textSecondary }}>
            {item.comment_count}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function CommentItem({
  comment,
  replies,
  myUserId,
  imgDomain,
  colors,
  stylesoy,
  onReply,
  onDelete,
}: {
  comment: any;
  replies: any[];
  myUserId?: string;
  imgDomain: string;
  colors: ThemeColors;
  stylesoy: ReturnType<typeof createStylesoy>;
  onReply: (comment: any) => void;
  onDelete: (comment: any) => void;
}) {
  return (
    <View style={stylesoy.commentRow}>
      <SafeImage
        style={stylesoy.commentAvatar}
        source={{ uri: imgDomain + (comment.user_image?.[0]?.p ?? '') }}
      />
      <View style={{ flex: 1 }}>
        <View style={stylesoy.commentBubble}>
          <Text style={{ fontWeight: '700', color: colors.text, fontSize: 13 }}>
            {comment.user_fullname}
          </Text>
          <Text style={{ color: colors.text, fontSize: 14 }}>
            {comment.comment_text}
          </Text>
        </View>
        <View style={stylesoy.commentMetaRow}>
          <Text style={stylesoy.commentMeta}>
            {help.timeAgo(comment.comment_dateAdded)}
          </Text>
          <Pressable onPress={() => onReply(comment)}>
            <Text style={stylesoy.commentMeta}>Reply</Text>
          </Pressable>
          {comment.comment_user_id === myUserId && (
            <Pressable onPress={() => onDelete(comment)}>
              <Text style={[stylesoy.commentMeta, { color: '#e11d48' }]}>
                Delete
              </Text>
            </Pressable>
          )}
        </View>

        {replies.map(reply => (
          <View key={reply.comment_id} style={stylesoy.commentReplyRow}>
            <SafeImage
              style={stylesoy.commentAvatarSmall}
              source={{ uri: imgDomain + (reply.user_image?.[0]?.p ?? '') }}
            />
            <View style={{ flex: 1 }}>
              <View style={stylesoy.commentBubble}>
                <Text
                  style={{
                    fontWeight: '700',
                    color: colors.text,
                    fontSize: 12,
                  }}
                >
                  {reply.user_fullname}
                </Text>
                <Text style={{ color: colors.text, fontSize: 13 }}>
                  {reply.comment_text}
                </Text>
              </View>
              <View style={stylesoy.commentMetaRow}>
                <Text style={stylesoy.commentMeta}>
                  {help.timeAgo(reply.comment_dateAdded)}
                </Text>
                {reply.comment_user_id === myUserId && (
                  <Pressable onPress={() => onDelete(reply)}>
                    <Text style={[stylesoy.commentMeta, { color: '#e11d48' }]}>
                      Delete
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function FullscreenMediaViewer({
  media,
  imgDomain,
  initialIndex,
  onClose,
}: {
  media: FeedMediaItem[] | null;
  imgDomain: string;
  initialIndex: number;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={!!media}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <Pressable
          style={fullscreenStyles.closeBtn}
          onPress={onClose}
          hitSlop={12}
        >
          <IIcon name="close" size={28} color="#fff" />
        </Pressable>
        {media && (
          <FlatList
            data={media}
            keyExtractor={(_, i) => String(i)}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={initialIndex}
            getItemLayout={(_, i) => ({
              length: screenWidth,
              offset: screenWidth * i,
              index: i,
            })}
            renderItem={({ item }) => (
              <View
                style={{
                  width: screenWidth,
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {item.type === 'video' ? (
                  <Video
                    source={{ uri: imgDomain + item.p }}
                    style={{ width: screenWidth, height: '100%' }}
                    resizeMode="contain"
                    controls
                    paused={false}
                  />
                ) : (
                  <SafeImage
                    style={{ width: screenWidth, height: '100%' }}
                    resizeMode="contain"
                    source={{ uri: imgDomain + item.p }}
                  />
                )}
              </View>
            )}
          />
        )}
      </View>
    </Modal>
  );
}

export function Screen_feed({
  navigation,
  route,
}: {
  navigation: any;
  route?: any;
}) {
  const { colors } = useTheme();
  const stylesoy = useMemoStyles(colors);
  const __MAPPER = cacheStorage.CONFIG.get()?.mapper;
  const imgDomain = __MAPPER?.img_domain?.[0] ?? '';
  const isMyTimeline = Boolean(route?.params?.onlyMine);
  const isFocused = useIsFocused();

  const [myProfile, setMyProfile] = useState<any>(null);
  useEffect(() => {
    cacheStorage.getCurrentUserProfile().then(setMyProfile);
  }, []);

  const [feedPosts, setFeedPosts] = useState<any[] | null>(null);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasNewPosts, setHasNewPosts] = useState(false);
  const isNearTopRef = useRef(true);
  const topPostIdRef = useRef<string | null>(null);
  const feedListRef = useRef<FlatList>(null);
  useEffect(() => {
    topPostIdRef.current = feedPosts?.[0]?.post_id ?? null;
  }, [feedPosts]);

  const [activePostId, setActivePostId] = useState<string | null>(null);
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    const mostVisible = viewableItems.find((v: any) => v.isViewable);
    setActivePostId(mostVisible?.item?.post_id ?? null);
  }).current;

  const [fullscreenMedia, setFullscreenMedia] = useState<{
    media: FeedMediaItem[];
    index: number;
  } | null>(null);

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

  const commentsSheetRef = useRef<BottomSheet>(null);
  const commentsSnapPoints = useMemo(() => ['92%'], []);
  const commentInputRef = useRef<TextInput>(null);
  const [commentsPost, setCommentsPost] = useState<any | null>(null);
  const [comments, setComments] = useState<any[] | null>(null);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  const fetchFeed = useCallback(
    async (cursor?: number | null) => {
      const response = await _http_request({
        reqType: 'POST',
        customApiUrl: __CONFIG__.HTTPS_API_DOMAIN + '/api/core/v1/getFeed',
        bodyArray: {
          ...(cursor ? { cursor } : {}),
          ...(isMyTimeline ? { onlyMine: true } : {}),
        },
      });
      if (response?.code !== 200) return null;
      return response;
    },
    [isMyTimeline],
  );

  useFocusEffect(
    useCallback(() => {
      if (feedPosts !== null) return;
      (async () => {
        const response = await fetchFeed();
        setFeedPosts(response?.feedPosts ?? []);
        setNextCursor(response?.nextCursor ?? null);
      })();
    }, [feedPosts, fetchFeed]),
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setHasNewPosts(false);
    const response = await fetchFeed();
    setFeedPosts(response?.feedPosts ?? []);
    setNextCursor(response?.nextCursor ?? null);
    setIsRefreshing(false);
  }, [fetchFeed]);

  // Background poll for new posts while this screen is focused -- silently refreshes
  // if the viewer is already near the top (they'll see it naturally), otherwise just
  // flags a banner so scrolled-down reading isn't interrupted.
  useFocusEffect(
    useCallback(() => {
      if (isMyTimeline) return;
      const interval = setInterval(async () => {
        const response = await fetchFeed();
        const latest = response?.feedPosts?.[0];
        if (!latest || latest.post_id === topPostIdRef.current) return;
        if (isNearTopRef.current) {
          setFeedPosts(response.feedPosts ?? []);
          setNextCursor(response.nextCursor ?? null);
        } else {
          setHasNewPosts(true);
        }
      }, FEED_POLL_INTERVAL_MS);
      return () => clearInterval(interval);
    }, [isMyTimeline, fetchFeed]),
  );

  const handleShowNewPosts = useCallback(async () => {
    await handleRefresh();
    feedListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [handleRefresh]);

  const handleFeedScroll = useCallback((e: any) => {
    isNearTopRef.current = e.nativeEvent.contentOffset.y < NEAR_TOP_THRESHOLD;
  }, []);

  const handleEndReached = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    const response = await fetchFeed(nextCursor);
    if (response?.feedPosts?.length) {
      setFeedPosts(prev => [...(prev ?? []), ...response.feedPosts]);
    }
    setNextCursor(response?.nextCursor ?? null);
    setIsLoadingMore(false);
  }, [nextCursor, isLoadingMore, fetchFeed]);

  const handlePickMedia = useCallback(
    async (mediaType: 'photo' | 'video' | 'mixed' = 'mixed') => {
      const remaining = MAX_COMPOSER_MEDIA - composerMedia.length;
      if (remaining <= 0) {
        Toastx.show({
          type: 'info',
          message: `You can attach up to ${MAX_COMPOSER_MEDIA} items.`,
        });
        return;
      }
      const media = await mediaHandler.handleSelectFromGallery({
        mediaType,
        selectionLimit: remaining,
      });
      if (!media || media.length === 0) return;
      const picked: PickedMedia[] = media
        .map(asset => {
          const localUri = asset?.uri ?? '';
          const isVideo = (asset.type ?? '').startsWith('video');
          return {
            type: isVideo ? 'video' : 'image',
            localUri,
            ext: getFileExtension(localUri),
            width: asset.width,
            height: asset.height,
          } as PickedMedia;
        })
        .filter(m => !!m.localUri);
      setComposerMedia(prev =>
        [...prev, ...picked].slice(0, MAX_COMPOSER_MEDIA),
      );
    },
    [composerMedia.length],
  );

  const openComposer = useCallback(
    (mode: 'text' | 'photo' | 'video') => {
      optionsSheetRef.current?.close();
      composerSheetRef.current?.expand();
      if (mode === 'photo' || mode === 'video') {
        handlePickMedia(mode);
      }
    },
    [handlePickMedia],
  );

  const handleSubmitPost = useCallback(async () => {
    const caption = composerText.trim();
    if (!caption && composerMedia.length === 0) {
      Toastx.show({
        type: 'error',
        message: 'Write something or attach a photo/video first.',
      });
      return;
    }

    setIsPosting(true);
    Loaderx.show();
    try {
      const media = await Promise.all(
        composerMedia.map(async (item, idx) => {
          const bucketType = 'feed-media';
          const presigned = await uploadHandler.requestPresignedURL_Upload(
            item.ext,
            bucketType,
          );
          const uploadFilePath = item.localUri.startsWith('file://')
            ? item.localUri.replace('file://', '')
            : item.localUri;
          const contentType = getMimeTypeFromExt(item.ext);

          const uploadResult = await RNFS.uploadFiles({
            toUrl: presigned.uploadUrl,
            files: [
              {
                name: 'file',
                filename: `feed_${Date.now()}_${idx}.${item.ext}`,
                filepath: uploadFilePath,
                filetype: contentType,
              },
            ],
            method: presigned.method || 'PUT',
            headers: { 'Content-Type': contentType },
            binaryStreamOnly: true,
          }).promise;

          if (uploadResult.statusCode < 200 || uploadResult.statusCode >= 300) {
            throw new Error('Media upload failed.');
          }

          const uploadedPath =
            '/' + uploadHandler.joinPath(presigned.bucket, presigned.fileKey);
          return {
            type: item.type,
            p: uploadedPath,
            w: item.width,
            h: item.height,
          };
        }),
      );

      const response = await _http_request({
        reqType: 'POST',
        customApiUrl: __CONFIG__.HTTPS_API_DOMAIN + '/api/core/v1/pushFeedPost',
        bodyArray: { caption, media },
      });

      if (response?.code === 200) {
        setComposerText('');
        setComposerMedia([]);
        composerSheetRef.current?.close();
        await handleRefresh();
        Toastx.show({ type: 'success', message: 'Posted!' });
      } else {
        Toastx.show({
          type: 'error',
          message: response?.message ?? 'Unable to post right now.',
        });
      }
    } catch (error: any) {
      logReport({
        type: 'function',
        extra: error?.message,
        useraction: 'pushFeedPost',
        logMessage: error?.message,
        stackTrace: error,
      });
      Toastx.show({
        type: 'error',
        message: error?.message ?? 'Unable to post right now.',
      });
    } finally {
      setIsPosting(false);
      Loaderx.hide();
    }
  }, [composerText, composerMedia, handleRefresh]);

  const handleReact = useCallback(
    async (post: any, kind: ReactionKind | 'remove') => {
      const prevReaction = post.viewer_reaction;
      const prevCount = post.reaction_count;
      const isRemoving = kind === 'remove';
      const nextReaction = isRemoving ? null : kind;
      const countDelta = isRemoving ? -1 : prevReaction ? 0 : 1;
      setFeedPosts(prev =>
        (prev ?? []).map(p =>
          p.post_id === post.post_id
            ? {
                ...p,
                viewer_reaction: nextReaction,
                reaction_count: p.reaction_count + countDelta,
              }
            : p,
        ),
      );
      const response = await _http_request({
        reqType: 'POST',
        customApiUrl:
          __CONFIG__.HTTPS_API_DOMAIN + '/api/core/v1/pushFeedReaction',
        bodyArray: { post_id: post.post_id, reaction: kind },
      });
      if (response?.code !== 200) {
        setFeedPosts(prev =>
          (prev ?? []).map(p =>
            p.post_id === post.post_id
              ? {
                  ...p,
                  viewer_reaction: prevReaction,
                  reaction_count: prevCount,
                }
              : p,
          ),
        );
        Toastx.show({
          type: 'error',
          message: response?.message ?? 'Unable to update your reaction.',
        });
      }
    },
    [],
  );

  const handleDeletePost = useCallback(async (post: any) => {
    setFeedPosts(prev => (prev ?? []).filter(p => p.post_id !== post.post_id));
    const response = await _http_request({
      reqType: 'POST',
      customApiUrl:
        __CONFIG__.HTTPS_API_DOMAIN + '/api/core/v1/pushDeleteFeedPost',
      bodyArray: { post_id: post.post_id },
    });
    if (response?.code === 200) {
      Toastx.show({ type: 'success', message: 'Post deleted.' });
    } else {
      setFeedPosts(prev => [post, ...(prev ?? [])]);
      Toastx.show({
        type: 'error',
        message: response?.message ?? 'Unable to delete post.',
      });
    }
  }, []);

  const handleReportPost = useCallback(async (post: any) => {
    const ok = await reportUser({
      reportedUserId: post.post_user_id,
      reportedPostId: post.post_id,
      reason: 'Reported from the feed 3-dot menu.',
    });
    Toastx.show(
      ok
        ? {
            type: 'success',
            message: 'Post reported. Thanks for letting us know.',
          }
        : { type: 'error', message: 'Unable to report this post right now.' },
    );
  }, []);

  const handleOpenPostMenu = useCallback((post: any) => {
    setMenuPost(post);
    postMenuSheetRef.current?.expand();
  }, []);

  const handleOpenComments = useCallback(async (post: any) => {
    setCommentsPost(post);
    setComments(null);
    setReplyingTo(null);
    commentsSheetRef.current?.expand();
    const response = await _http_request({
      reqType: 'POST',
      customApiUrl:
        __CONFIG__.HTTPS_API_DOMAIN + '/api/core/v1/getFeedComments',
      bodyArray: { post_id: post.post_id },
    });
    setComments(response?.code === 200 ? response.comments : []);
  }, []);

  const handleSubmitComment = useCallback(async () => {
    const text = commentText.trim();
    if (!text || !commentsPost) return;
    setIsSubmittingComment(true);
    const response = await _http_request({
      reqType: 'POST',
      customApiUrl:
        __CONFIG__.HTTPS_API_DOMAIN + '/api/core/v1/pushFeedComment',
      bodyArray: {
        post_id: commentsPost.post_id,
        text,
        parent_id: replyingTo?.id,
      },
    });
    if (response?.code === 200) {
      const newComment = {
        comment_id: response.commentId,
        comment_parent_id: replyingTo?.id ?? null,
        comment_user_id: myProfile?.user_id,
        comment_text: text,
        comment_dateAdded: response.dateAdded,
        user_fullname: myProfile?.user_fullname,
        user_image: myProfile?.user_image ?? [],
      };
      setComments(prev => [...(prev ?? []), newComment]);
      const postedForId = commentsPost.post_id;
      setFeedPosts(prev =>
        (prev ?? []).map(p =>
          p.post_id === postedForId
            ? { ...p, comment_count: p.comment_count + 1 }
            : p,
        ),
      );
      setCommentText('');
      setReplyingTo(null);
    } else {
      Toastx.show({
        type: 'error',
        message: response?.message ?? 'Unable to post your comment.',
      });
    }
    setIsSubmittingComment(false);
  }, [commentText, commentsPost, replyingTo, myProfile]);

  const handleDeleteComment = useCallback(
    async (comment: any) => {
      const removedCount =
        1 +
        (comments ?? []).filter(c => c.comment_parent_id === comment.comment_id)
          .length;
      setComments(prev =>
        (prev ?? []).filter(
          c =>
            c.comment_id !== comment.comment_id &&
            c.comment_parent_id !== comment.comment_id,
        ),
      );
      const postId = commentsPost?.post_id;
      if (postId) {
        setFeedPosts(prev =>
          (prev ?? []).map(p =>
            p.post_id === postId
              ? {
                  ...p,
                  comment_count: Math.max(0, p.comment_count - removedCount),
                }
              : p,
          ),
        );
      }
      const response = await _http_request({
        reqType: 'POST',
        customApiUrl:
          __CONFIG__.HTTPS_API_DOMAIN + '/api/core/v1/pushDeleteFeedComment',
        bodyArray: { comment_id: comment.comment_id },
      });
      if (response?.code !== 200) {
        Toastx.show({
          type: 'error',
          message: response?.message ?? 'Unable to delete comment.',
        });
      }
    },
    [comments, commentsPost],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: isMyTimeline ? 'My Posts' : 'Feed',
      headerRight: isMyTimeline
        ? undefined
        : () => (
            <Pressable
              style={stylesoy.headerButton}
              onPress={() =>
                navigation.navigate(namer.navigation.myTimeline, {
                  onlyMine: true,
                })
              }
            >
              <IIcon
                name="person-circle-outline"
                size={26}
                color={colors.text}
              />
            </Pressable>
          ),
    });
  }, [navigation, colors, stylesoy, isMyTimeline]);

  if (feedPosts === null) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Skeleton style={{ height: 90, borderRadius: 16, marginBottom: 12 }} />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton
            key={i}
            style={{ height: 260, borderRadius: 16, marginBottom: 12 }}
          />
        ))}
      </View>
    );
  }

  const topLevelComments = (comments ?? []).filter(c => !c.comment_parent_id);
  const repliesByParent = (comments ?? []).reduce(
    (acc: Record<string, any[]>, c) => {
      if (c.comment_parent_id) {
        acc[c.comment_parent_id] = acc[c.comment_parent_id] ?? [];
        acc[c.comment_parent_id].push(c);
      }
      return acc;
    },
    {},
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        ref={feedListRef}
        data={feedPosts}
        keyExtractor={item => item.post_id}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.3}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
        onScroll={handleFeedScroll}
        scrollEventThrottle={100}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.conainerScrollView,
          { paddingVertical: 5, gap: 12 },
        ]}
        ListHeaderComponent={
          <Pressable
            style={stylesoy.composerCard}
            onPress={() => openComposer('text')}
          >
            <SafeImage
              style={stylesoy.composerCardAvatar}
              source={{
                uri: imgDomain + (myProfile?.user_image?.[0]?.p ?? ''),
              }}
            />
            <View style={stylesoy.composerCardInputFake}>
              <Text style={{ color: colors.textTertiary }}>
                What's on your mind?
              </Text>
            </View>
            <Pressable
              style={stylesoy.composerCardIconBtn}
              onPress={() => openComposer('photo')}
            >
              <MaterialCommunityIcons
                name="image-outline"
                size={22}
                color={colors.accent}
              />
            </Pressable>
          </Pressable>
        }
        renderItem={({ item }) => (
          <FeedPostCard
            item={item}
            imgDomain={imgDomain}
            colors={colors}
            stylesoy={stylesoy}
            isMyTimeline={isMyTimeline}
            isActive={isFocused && item.post_id === activePostId}
            onPressProfile={() =>
              navigation.navigate(namer.navigation.peoplesOnePerson, {
                getOnePersonId: item.post_user_id,
              })
            }
            onReact={handleReact}
            onOpenMenu={handleOpenPostMenu}
            onOpenComments={handleOpenComments}
            onOpenFullscreen={(media, index) =>
              setFullscreenMedia({ media, index })
            }
          />
        )}
        ListEmptyComponent={
          <View style={{ paddingVertical: 40, alignItems: 'center', gap: 8 }}>
            <MaterialCommunityIcons
              name="post-outline"
              size={34}
              color={colors.primary}
            />
            <Text style={{ color: colors.textSecondary }}>
              {isMyTimeline
                ? "You haven't posted anything yet."
                : 'No posts in your feed yet.'}
            </Text>
          </View>
        }
        ListFooterComponent={
          isLoadingMore ? (
            <View style={{ alignItems: 'center', paddingVertical: 12 }}>
              <ActivityIndicator size="small" color={colors.accent} />
            </View>
          ) : null
        }
      />

      {hasNewPosts && (
        <Pressable style={stylesoy.newPostsBanner} onPress={handleShowNewPosts}>
          <IIcon name="arrow-up" size={14} color="#fff" />
          <Text style={stylesoy.newPostsBannerText}>New posts</Text>
        </Pressable>
      )}

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
          <Text style={[stylesoy.composerTitle, { color: colors.text }]}>
            New Post
          </Text>
          <Pressable
            style={stylesoy.optionRow}
            onPress={() => openComposer('text')}
          >
            <View style={stylesoy.optionIconWrap}>
              <MaterialCommunityIcons
                name="text"
                size={22}
                color={colors.accent}
              />
            </View>
            <Text style={[stylesoy.optionLabel, { color: colors.text }]}>
              Text
            </Text>
          </Pressable>
          <Pressable
            style={stylesoy.optionRow}
            onPress={() => openComposer('photo')}
          >
            <View style={stylesoy.optionIconWrap}>
              <MaterialCommunityIcons
                name="image-outline"
                size={22}
                color={colors.accent}
              />
            </View>
            <Text style={[stylesoy.optionLabel, { color: colors.text }]}>
              Photo
            </Text>
          </Pressable>
          <Pressable
            style={stylesoy.optionRow}
            onPress={() => openComposer('video')}
          >
            <View style={stylesoy.optionIconWrap}>
              <MaterialCommunityIcons
                name="video-outline"
                size={22}
                color={colors.accent}
              />
            </View>
            <Text style={[stylesoy.optionLabel, { color: colors.text }]}>
              Video
            </Text>
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
              <View
                style={[stylesoy.optionIconWrap, stylesoy.optionIconWrapDanger]}
              >
                <IIcon name="trash-outline" size={20} color="#e11d48" />
              </View>
              <Text style={[stylesoy.optionLabel, { color: '#e11d48' }]}>
                Delete Post
              </Text>
            </Pressable>
          ) : (
            <Pressable
              style={stylesoy.optionRow}
              onPress={() => {
                postMenuSheetRef.current?.close();
                if (menuPost) handleReportPost(menuPost);
              }}
            >
              <View
                style={[stylesoy.optionIconWrap, stylesoy.optionIconWrapDanger]}
              >
                <IIcon name="flag-outline" size={20} color="#e11d48" />
              </View>
              <Text style={[stylesoy.optionLabel, { color: '#e11d48' }]}>
                Report Post
              </Text>
            </Pressable>
          )}
        </BottomSheetView>
      </BottomSheet>

      <BottomSheet
        ref={commentsSheetRef}
        index={-1}
        enablePanDownToClose
        snapPoints={commentsSnapPoints}
        backdropComponent={bottomsheet_renderBackdrop}
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
        onClose={() => {
          setCommentsPost(null);
          setComments(null);
          setReplyingTo(null);
          setCommentText('');
        }}
      >
        <BottomSheetView style={stylesoy.commentsSheet}>
          <View style={stylesoy.commentsHeader}>
            <Text
              style={[
                stylesoy.composerTitle,
                { color: colors.text, marginBottom: 0 },
              ]}
            >
              Comments
              {typeof commentsPost?.comment_count === 'number'
                ? ` · ${commentsPost.comment_count}`
                : ''}
            </Text>
          </View>

          {comments === null ? (
            <View style={stylesoy.commentsCenterFill}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : (
            <BottomSheetFlatList
              style={{ flex: 1 }}
              data={topLevelComments}
              keyExtractor={(c: any) => c.comment_id}
              contentContainerStyle={{ padding: 16, gap: 16, flexGrow: 1 }}
              renderItem={({ item: c }: any) => (
                <CommentItem
                  comment={c}
                  replies={repliesByParent[c.comment_id] ?? []}
                  myUserId={myProfile?.user_id}
                  imgDomain={imgDomain}
                  colors={colors}
                  stylesoy={stylesoy}
                  onReply={cmt => {
                    setReplyingTo({
                      id: cmt.comment_id,
                      name: cmt.user_fullname,
                    });
                    commentInputRef.current?.focus();
                  }}
                  onDelete={handleDeleteComment}
                />
              )}
              ListEmptyComponent={
                <View style={stylesoy.commentsCenterFill}>
                  <IIcon
                    name="chatbubble-outline"
                    size={30}
                    color={colors.textTertiary}
                  />
                  <Text style={{ color: colors.textSecondary, marginTop: 8 }}>
                    No comments yet. Say something!
                  </Text>
                </View>
              }
            />
          )}

          <View style={stylesoy.commentInputRow}>
            {replyingTo && (
              <View style={stylesoy.replyingToChip}>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  Replying to {replyingTo.name}
                </Text>
                <Pressable onPress={() => setReplyingTo(null)} hitSlop={8}>
                  <IIcon name="close" size={14} color={colors.textSecondary} />
                </Pressable>
              </View>
            )}
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
              <TextInput
                ref={commentInputRef}
                style={[stylesoy.commentInput, { color: colors.text }]}
                placeholder={
                  replyingTo
                    ? `Reply to ${replyingTo.name}...`
                    : 'Add a comment...'
                }
                placeholderTextColor={colors.textTertiary}
                value={commentText}
                onChangeText={setCommentText}
                multiline
              />
              <Pressable
                style={[
                  stylesoy.commentSendBtn,
                  {
                    opacity:
                      isSubmittingComment || !commentText.trim() ? 0.5 : 1,
                  },
                ]}
                disabled={isSubmittingComment || !commentText.trim()}
                onPress={handleSubmitComment}
              >
                <IIcon name="send" size={18} color="#fff" />
              </Pressable>
            </View>
          </View>
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
        onChange={sheetIndex => {
          if (sheetIndex === 0) composerInputRef.current?.focus();
        }}
      >
        <BottomSheetView style={{ padding: 16, flex: 1 }}>
          <Text style={[stylesoy.composerTitle, { color: colors.text }]}>
            New Post
          </Text>
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
                    <Video
                      source={{ uri: m.localUri }}
                      style={stylesoy.composerThumb}
                      resizeMode="cover"
                      muted
                      paused
                    />
                  ) : (
                    <SafeImage
                      style={stylesoy.composerThumb}
                      source={{ uri: m.localUri }}
                    />
                  )}
                  <Pressable
                    style={stylesoy.removeMediaBtn}
                    onPress={() =>
                      setComposerMedia(prev => prev.filter((_, i) => i !== idx))
                    }
                  >
                    <IIcon name="close" size={14} color="#fff" />
                  </Pressable>
                </View>
              ))}
              {composerMedia.length < MAX_COMPOSER_MEDIA && (
                <Pressable
                  style={stylesoy.addMoreThumb}
                  onPress={() => handlePickMedia()}
                >
                  <IIcon name="add" size={24} color={colors.accent} />
                </Pressable>
              )}
            </View>
          )}
          <View style={stylesoy.composerActions}>
            {composerMedia.length === 0 && (
              <Pressable
                style={stylesoy.attachBtn}
                onPress={() => handlePickMedia()}
              >
                <MaterialCommunityIcons
                  name="image-multiple-outline"
                  size={20}
                  color={colors.accent}
                />
                <Text style={{ color: colors.accent, fontWeight: '600' }}>
                  Photo/Video
                </Text>
              </Pressable>
            )}
            <Pressable
              style={[
                stylesoy.postBtn,
                { opacity: isPosting ? 0.6 : 1, marginLeft: 'auto' },
              ]}
              disabled={isPosting}
              onPress={handleSubmitPost}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>Post</Text>
            </Pressable>
          </View>
        </BottomSheetView>
      </BottomSheet>

      <FullscreenMediaViewer
        media={fullscreenMedia?.media ?? null}
        imgDomain={imgDomain}
        initialIndex={fullscreenMedia?.index ?? 0}
        onClose={() => setFullscreenMedia(null)}
      />
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
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dotActive: { backgroundColor: '#fff' },
  counterPill: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  counterText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});

const fullscreenStyles = StyleSheet.create({
  closeBtn: {
    position: 'absolute',
    top: 50,
    right: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
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
    newPostsBanner: {
      position: 'absolute',
      top: 12,
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.accent,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      shadowColor: colors.shadow,
      shadowOpacity: 0.3,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 6,
    },
    newPostsBannerText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    composerCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 12,
      marginBottom: 12,
    },
    composerCardAvatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.backgroundSecondary,
    },
    composerCardInputFake: {
      flex: 1,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    composerCardIconBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
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
    reactionPickerRow: {
      position: 'absolute',
      flexDirection: 'row',
      gap: 4,
      backgroundColor: colors.surface,
      borderRadius: 26,
      paddingHorizontal: 8,
      paddingVertical: 6,
      shadowColor: colors.shadow,
      shadowOpacity: 0.25,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 10,
    },
    reactionPickerItem: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    commentsSheet: {
      flex: 1,
    },
    commentsHeader: {
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    commentsCenterFill: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
    },
    commentRow: {
      flexDirection: 'row',
      gap: 10,
    },
    commentAvatar: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.backgroundSecondary,
    },
    commentAvatarSmall: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.backgroundSecondary,
    },
    commentBubble: {
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 8,
      gap: 2,
      alignSelf: 'flex-start',
      maxWidth: '100%',
    },
    commentMetaRow: {
      flexDirection: 'row',
      gap: 16,
      marginTop: 5,
      marginLeft: 10,
    },
    commentMeta: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    commentReplyRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 12,
      marginLeft: 22,
    },
    commentInputRow: {
      backgroundColor: colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 16,
      gap: 8,
    },
    replyingToChip: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    commentInput: {
      flex: 1,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 10,
      maxHeight: 100,
      fontSize: 14,
    },
    commentSendBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
