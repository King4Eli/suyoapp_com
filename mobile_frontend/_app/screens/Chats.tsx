import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing, Platform, ImageBackground, FlatList, ScrollView, ActivityIndicator } from 'react-native';
import { Loaderx } from '../funcs/functions_stateful';
import { useFocusEffect } from '@react-navigation/native';
import { namer, resourceMap, styles, __CONFIG__ } from '../funcs/static';
import { _http_request, cacheStorage, help, logReport } from '../funcs/functions';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useStableHeaderHeight } from '../funcs/useStableHeaderHeight';
import MIcon from "react-native-vector-icons/MaterialCommunityIcons";
import IIcon from 'react-native-vector-icons/Ionicons';
import FastImage from 'react-native-fast-image'
import { SafeImage } from '../funcs/customImage';
import LottieView from 'lottie-react-native';
import { useTheme } from '../funcs/theme';


export function Screen_chat({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const [getProfile, setProfile] = useState<any>(null);
  const __MAPPER = cacheStorage.CONFIG.get()?.mapper;

  const imageDomain = __MAPPER?.img_domain[0];

  const [getNewMatches, setNewMatches] = useState<any>(null);
  const [getEngagedMessages, setEngagedMessages] = useState<any>([]);
  const [getCountLikes, setCountLikes] = useState<number>(0);
  const [getImageLikes, setImageLikes] = useState<{ p: string, w: string, h: string }>({ p: "", w: "", h: "" });
  const headerHeight = useStableHeaderHeight();
  const activeSubscription = help.getSubscriptionState(getProfile).hasActive;
  const [activeFilter, setActiveFilter] = useState<'all' | 'yourTurn' | 'verified' | 'unread'>('all');
  const [visibleMessages, setVisibleMessages] = useState<number>(6);
  const CHATS_PAGE_SIZE = 5;
  const hasLikes = getCountLikes > 0;
  const hasNewMatches = Array.isArray(getNewMatches) && getNewMatches.length > 0;



  useFocusEffect(
    React.useCallback(() => {
      let mounted = true;
      (async () => {
        try {
          const [profile] = await Promise.all([
            cacheStorage.getCurrentUserProfile()
          ]);

          if (mounted) {
            setProfile(profile);
          }
        } catch {
          if (mounted) {
            setProfile(null);
          }
        }
      })();

      return () => { mounted = false; };
    }, [])
  );




  const bounceAnim = new Animated.Value(0);
  const bounceInterpolate = bounceAnim.interpolate({
    inputRange: [0, 0.8, 1],
    outputRange: [0, -10, 0]
  });

  const pendingRepliesCount = useMemo(() => {
    return (getEngagedMessages ?? []).filter((item: any) => !item?.convo_from_me).length;
  }, [getEngagedMessages]);

  const verifiedMatchesCount = useMemo(() => {
    return (getEngagedMessages ?? []).filter((item: any) => item?.user_verfied).length;
  }, [getEngagedMessages]);

  const filteredMessages = useMemo(() => {
    const list = getEngagedMessages ?? [];
    switch (activeFilter) {
      case 'yourTurn':
        return list.filter((item: any) => !item?.convo_from_me);
      case 'verified':
        return list.filter((item: any) => item?.user_verified);
      case 'unread':
        return list.filter((item: any) => !item?.last_message_read);
      case 'all':
      default:
        return list;
    }
  }, [activeFilter, getEngagedMessages]);

  useEffect(() => {
    setVisibleMessages((prev) => {
      const next = Math.min(prev, (filteredMessages ?? []).length || CHATS_PAGE_SIZE);
      return next || CHATS_PAGE_SIZE;
    });
  }, [filteredMessages]);

  // animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(bounceAnim, {
          toValue: 0,
          duration: 700,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        })
      ]), { iterations: 3 }).start();
  });

  const NoConversationsScreen = () => {
    return (
      <View style={stylesc.emptyState}>
        <IIcon name="chatbubble-ellipses-outline" size={48} color={colors.textTertiary} />
        <Text style={[stylesc.emptyText, { color: colors.textSecondary }]}>No Conversations Yet</Text>
        <Text style={[stylesc.emptySubtext, { color: colors.textTertiary }]}>Start chatting with your matches and spark a new connection!</Text>
      </View>
    );
  };



  const filtersList = [
    { id: 'all', label: 'All chats' },
    { id: 'yourTurn', label: 'Your turn' },
    { id: 'unread', label: 'Unread' },
    //{ id: 'verified', label: 'Verified' },
  ] as const;

  const countNewMatches = getNewMatches?.length ?? 0;
  // const countTotalConvo = getEngagedMessages?.length ?? 0;

  const renderHeroSection = useCallback(() => { 
    return (
      <View style={{ backgroundColor: '#0f172a', borderRadius: 16, padding: 14, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', textTransform: "capitalize" }}>{getProfile?.profile?.fullname || 'You'}</Text>
            {countNewMatches > 0 && <Text style={{ color: '#cbd5e1', marginTop: 4, fontSize: 13 }}>You have {countNewMatches} new connection{countNewMatches > 1 ? "s" : ""}. Message them before the sparks fade.</Text>}
          </View>
        </View>

        <View style={{ flexDirection: 'row', marginTop: 10, gap: 10 }}>
          <Pressable onPress={() => navigation.navigate(namer.navigation.subscription)} style={{ flex: 1, backgroundColor: '#1d4ed8', borderRadius: 12, padding: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <MaterialCommunityIcons name='lightning-bolt-outline' size={18} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700' }}>Boost visibility</Text>
          </Pressable>
          {!activeSubscription && (
          <Pressable onPress={() => navigation.navigate(namer.navigation.subscription)} style={{ flex: 1, backgroundColor: '#1d4ed8', borderRadius: 12, padding: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <IIcon name="diamond" size={18} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700' }}>Unlock premium</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }, [activeSubscription, getEngagedMessages, getNewMatches, getProfile, pendingRepliesCount, verifiedMatchesCount]);

  const renderFiltersRow = useCallback(() => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
      {filtersList.map((filter) => {
        const isActive = activeFilter === filter.id;
        return (
          <Pressable key={filter.id} onPress={() => setActiveFilter(filter.id)} style={{
            paddingHorizontal: 12,
            paddingVertical: 9,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: isActive ? colors.accent : colors.border,
            backgroundColor: isActive ? colors.backgroundSecondary : colors.backgroundSecondary
          }}>
            <Text style={{ color: isActive ? colors.accent : colors.textSecondary, fontWeight: '600', fontSize: 12 }}>{filter.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  ), [activeFilter, filtersList, colors]);



  const renderConnectionsSection = useCallback(() => {
    const matches = hasNewMatches ? getNewMatches : [];

    //if (!hasLikes && !hasNewMatches) return null;
    return (
      <View style={{ backgroundColor: colors.surface, borderRadius: 16, gap: 10, }}>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          {hasLikes && (
            <Animated.View style={{ transform: [{ translateY: bounceInterpolate }] }}>
              <Pressable onPress={() => navigation.navigate(namer.navigation.likes)} style={{ width: 110, height: 180, borderRadius: 10, overflow: 'hidden', backgroundColor: '#0ea5e9', justifyContent: 'center', alignItems: 'center' }}>
                <ImageBackground progressiveRenderingEnabled={true} blurRadius={activeSubscription ? 0 : (Platform.OS === "android" ? 60 : 30)}
                  style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}
                  source={{ cache: 'default', uri: imageDomain + String(getImageLikes?.p) }} >
                  <View style={{ backgroundColor: 'rgba(15,23,42,0.7)', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{getCountLikes > 99 ? '99+' : '+'+ getCountLikes}</Text>
                  </View>
                  <Text style={{ color: '#fff', marginTop: 10, fontWeight: '700' }}>See likes</Text>
                </ImageBackground>
              </Pressable>
            </Animated.View>
          )}

          <View style={{ flex: 1, minHeight: 180 }}>
            {hasNewMatches ? (
              <FlatList horizontal showsHorizontalScrollIndicator={false}
                data={matches} removeClippedSubviews={false}
                keyExtractor={(item, index) => `match-${item?.match_id}-${index}`}
                renderItem={({ item }) => (
                  <Pressable style={{ width: 120 }} onPress={() => { navigation.navigate(namer.navigation.conversation, { matchId: item?.match_id }); }}>
                    <View style={{ borderRadius: 10, overflow: 'hidden', backgroundColor: '#e2e8f0', height: 180, justifyContent: 'flex-end' }}>
                      <SafeImage style={{ position: 'absolute', width: '100%', height: '100%' }} source={{ cache: FastImage.cacheControl.immutable, uri: String(imageDomain + item?.user_image?.p) }}
                        onError={() => { return logReport({ type: "http -image", logMessage: "Image load", url: imageDomain + (getProfile?.profile?.images?.[0]?.p ?? ""), useraction: 'Image Load', stackTrace: null }); }} />
                      <View style={{ backgroundColor: 'rgba(0,0,0,0.4)', padding: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#ffffffff', textTransform: 'capitalize', flex: 1 }} numberOfLines={2}>
                          {item?.user_fullname}{item?.user_dob ? `, ${help.getageFromDOB(item.user_dob)}` : ''}
                        </Text>
                        {item?.user_verfied === 1 && (<IIcon name="checkmark-done-circle-sharp" size={16} color="#38bdf8" />)}
                      </View>
                    </View>
                  </Pressable>
                )}
                contentContainerStyle={{ gap: 12 }}
                scrollEnabled
                nestedScrollEnabled
              />
            ) : (
              <View style={{ flex: 1, height: 180, backgroundColor: colors.backgroundSecondary, borderRadius: 16, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', padding: 12, gap: 6 }}>
                <IIcon name="sparkles-outline" size={30} color={colors.textTertiary} />
                <Text style={{ color: colors.text, fontWeight: '700' }}>No new connections yet</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, textAlign: 'center' }}>Keep swiping to spark new conversations.</Text>
                <Pressable onPress={() => navigation.navigate(namer.navigation.peoples)} style={{ marginTop: 4, backgroundColor: colors.accent, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 }}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Continue swiping</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  }, [activeSubscription, bounceInterpolate, getCountLikes, getNewMatches, getProfile, colors]);



  useFocusEffect(React.useCallback(() => {
    _http_request({
      customApiUrl: __CONFIG__.HTTPS_API_DOMAIN + "/api/core/v1/getChatLists",
      reqType: 'POST',
    }).then((response: any) => {
      setTimeout(() => {
        Loaderx.hide();
        setNewMatches((prev: any) => {
          const incoming = response?.chatsListings?.withoutmessages;
          if (incoming === null || incoming === undefined || !Array.isArray(incoming)) {
            return prev ?? [];
          }
          return incoming;
        });
        setEngagedMessages((prev: any) => {
          const incoming = response?.chatsListings?.withmessages;
          if (incoming === null || incoming === undefined || (!Array.isArray(incoming))) {
            return prev ?? [];
          }
          return incoming;
        });
        setCountLikes((prev: number) => {
          const incoming = response?.chatsListings?.countLikes;
          if (incoming === null || incoming === undefined || incoming === '') {
            return prev;
          }
          return incoming;
        });
        setImageLikes((prev: {}) => {
          const incoming = response?.chatsListings?.imageLikes;
          if (incoming === null || incoming === undefined || incoming === '') {
            return prev;
          }
          return incoming;
        });
      }, getNewMatches ? 0 : 1000);
    });
  }, []));

  if (getNewMatches === null) {
    return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}><LottieView source={resourceMap.lottie.infinityLoading} autoPlay loop style={{ width: 220, height: 220 }} /></View>
  }

  // Replace the entire FlatList section (around line 290-330) with this:

  return (
    <View style={[styles.container, { paddingTop: headerHeight, backgroundColor: colors.background }]}>
      <View style={styles.zcircle1} />
      <View style={styles.zcircle2} />
      <View style={styles.zcircle3} />

      <FlatList
        data={filteredMessages.slice(0, visibleMessages)}
        keyExtractor={(item, index) => `chat-${item?.match_id}-${index}`}
        renderItem={({ item, index }) => {
          const isYourTurn = !item?.convo_from_me;
          const isVerified = item?.user_verified;
          const lastMessage = () => {
            // Message types are set by pushConversation.js: "text", "image", "video", "audio".
            // Each send produces separate rows per type, so a message is never a text+media combo.
            const previewWeight = item?.last_message_read ? 400 : 800;
            switch (item?.user_lastmessage?.t) {
              case "text":
                return <Text style={{ fontSize: 13, color: colors.textSecondary, flex: 1, fontWeight: previewWeight }} numberOfLines={1} ellipsizeMode="tail">{item?.user_lastmessage?.str}</Text>
              case "image":
                return (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <IIcon name="image-outline" size={16} color={colors.textSecondary} />
                    <Text style={{ fontSize: 13, color: colors.textSecondary, flex: 1, fontWeight: previewWeight }}>Photo</Text>
                  </View>
                )
              case "video":
                return (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <IIcon name="videocam-outline" size={16} color={colors.textSecondary} />
                    <Text style={{ fontSize: 13, color: colors.textSecondary, flex: 1, fontWeight: previewWeight }}>Video</Text>
                  </View>
                )
              case "audio":
                return (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <MIcon name="microphone" size={16} color={colors.textSecondary} />
                    <Text style={{ fontSize: 13, color: colors.textSecondary, flex: 1, fontWeight: previewWeight }}>Voice message</Text>
                  </View>
                )
              case "deleted":
                return (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <MIcon name="close-circle-outline" size={16} color={colors.textSecondary} />
                    <Text style={{ fontSize: 13, color: colors.textSecondary, flex: 1, fontStyle: 'italic', fontWeight: '400' }}>Message deleted</Text>
                  </View>
                )
              default:
                return (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <MIcon name="file-outline" size={16} color={colors.textSecondary} />
                    <Text style={{ fontSize: 13, color: colors.textSecondary, flex: 1, fontWeight: previewWeight }}>Attachment</Text>
                  </View>
                )
            }
          };

          return (
            <Pressable key={`message-${item?.match_id}-${index}`} onPress={() => { navigation.navigate(namer.navigation.conversation, { matchId: item?.match_id }); }}>
              <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 12, flexDirection: 'row', gap: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border, shadowColor: colors.shadow, shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 }}>
                <SafeImage style={{ height: 58, width: 58, borderRadius: 16, backgroundColor: colors.backgroundSecondary }} source={{ uri: String(imageDomain + item?.user_image?.p), cache: FastImage.cacheControl.immutable, }}
                  onError={() => { return logReport({ type: "http -image", logMessage: "Image load", url: imageDomain + (item?.user_image?.p ?? ""), useraction: 'Image Load', stackTrace: null }); }} />
                <View style={{ flex: 1, gap: 5 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', textTransform: 'capitalize', color: colors.text }} numberOfLines={1}>{item?.user_fullname}</Text>
                      {isVerified && <IIcon name="checkmark-done-circle-sharp" size={20} color={colors.accent} />}
                    </View>
                    {item?.user_lastmessage_date && <Text style={{ fontSize: 11, color: colors.textSecondary }}>{help.timeAgo(item?.user_lastmessage_date)}</Text>}
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    {lastMessage()}
                    {isYourTurn && (
                      <View style={{ backgroundColor: colors.backgroundSecondary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 }}>
                        <Text style={{ fontSize: 11, color: colors.accent, fontWeight: '700' }}>Your turn</Text>
                      </View>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {item?.user_distance && <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: colors.backgroundSecondary }}><Text style={{ color: colors.textSecondary, fontSize: 11 }}>{item.user_distance} away</Text></View>}
                  </View>
                </View>
              </View>
            </Pressable>
          );
        }}
        ListHeaderComponent={
          <View style={{ gap: 10}}>
            {renderHeroSection()}
            {renderConnectionsSection()}
            {<Text style={{ fontSize: 17, fontWeight: '700', }}>Conversations</Text>}
            {renderFiltersRow()}
          </View>
        }
        ListEmptyComponent={<NoConversationsScreen />}
        ListFooterComponent={
          visibleMessages < filteredMessages.length ? (
            <View style={{ alignItems: 'center', paddingVertical: 12, width: '100%' }}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={{ marginTop: 6, color: colors.textSecondary, fontSize: 12 }}>Loading more conversations...</Text>
            </View>
          ) : null
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 6, paddingBottom: 20 }}
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={5}
        removeClippedSubviews={false}
        onEndReached={() => {
          setTimeout(() => {
            setVisibleMessages((prev) => {
              if (prev >= filteredMessages.length) return prev;
              return Math.min(prev + CHATS_PAGE_SIZE, filteredMessages.length);
            });
          }, 1000);
        }}
        onEndReachedThreshold={0.4}
      />
    </View>
  );
}

const stylesc = StyleSheet.create({
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
    marginTop: 12,
    textAlign: "center"
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
    textAlign: "center"
  }
});
