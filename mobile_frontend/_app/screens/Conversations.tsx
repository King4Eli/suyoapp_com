import React, { useState, useEffect, useRef, useLayoutEffect, useMemo, useCallback } from 'react';
import { View, Text, Pressable, TextInput, Alert, FlatList, Platform, TouchableOpacity, KeyboardAvoidingView, PermissionsAndroid, Linking, ImageBackground, Animated } from 'react-native';
import { Loaderx, bottomsheet_renderBackdrop } from '../funcs/functions_stateful';
import IonIcon from 'react-native-vector-icons/Ionicons';
import { namer, styles, __CONFIG__ } from '../funcs/static';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { _http_request, help, mediaHandler, screenWidth, logReport, uploadHandler, navigationRef, cacheStorage } from '../funcs/functions';
import { Asset } from 'react-native-image-picker';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Sound, { AudioEncoderAndroidType, AudioSourceAndroidType, AVEncoderAudioQualityIOSType, OutputFormatAndroidType } from 'react-native-nitro-sound';
import RNFS from 'react-native-fs';
import Icon from 'react-native-vector-icons/Ionicons';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { Toastx } from '../funcs/customNotification';
import FastImage from 'react-native-fast-image';
import { SafeImage } from '../funcs/customImage';
import { SocketClient } from '../funcs/socket_realtimeData';
import ImageViewing from 'react-native-image-viewing';
import { useTheme } from '../funcs/theme';

const CONFIG = {
    imgSelectUploadLimit: 4,
    AUDIO_WAVE_BARS: 26,
    MAX_RECORDING_MS: 3 * 60 * 1000,
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const hashString = (value: string) => {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
        hash = ((hash * 31) + value.charCodeAt(i)) % 2147483647;
    }
    return Math.abs(hash);
}; 
const normalizeMetering = (metering?: number | null) => {
    if (metering == null || Number.isNaN(metering)) return null;
    // Nitro sound metering is commonly in negative dB (-160..0); clamp at -60 for useful motion.
    return clamp01((metering + 60) / 60);
};

// Mimics iOS's system recording indicator: a soft breathing red dot.
const RecordingDot = () => {
    const pulse = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 0.25, duration: 650, useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [pulse]);
    return (
        <Animated.View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: '#ff3b30', opacity: pulse }} />
    );
};

// Peer-typing indicator, styled as their message bubble (left-aligned, same blue)
// with three dots bouncing in sequence -- the standard iMessage/WhatsApp treatment.
const TypingBubble = () => {
    const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
    useEffect(() => {
        const loops = dots.map((dot, i) => Animated.loop(
            Animated.sequence([
                Animated.delay(i * 150),
                Animated.timing(dot, { toValue: -4, duration: 300, useNativeDriver: true }),
                Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
                Animated.delay((2 - i) * 150),
            ])
        ));
        loops.forEach((loop) => loop.start());
        return () => loops.forEach((loop) => loop.stop());
    }, []);
    return (
        <View style={[styles.conversation_message_container, styles.conversation_nextUserMessage]}>
            <View style={[styles.conversation_messageBubble, {
                borderBottomLeftRadius: 0,
                backgroundColor: '#0078fe',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingVertical: 12,
            }]}>
                {dots.map((dot, i) => (
                    <Animated.View key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff', transform: [{ translateY: dot }] }} />
                ))}
            </View>
        </View>
    );
};

interface convoInterface {
    messageId: string;
    fromMe: boolean;
    type: 'media' | 'text' | 'audio' | 'image' | 'video' | 'file' | 'deleted';
    message: string | null;
    src: any[] | null;
    isUploading?: boolean;
    // 'failed' keeps the bubble on screen (instead of deleting it) with a retry
    // affordance -- `src`/`message` still hold the original local data needed to
    // retry, since a failed upload never gets overwritten with a server URL.
    status?: 'sending' | 'failed';
    // Only ever present on fromMe messages, and only when the viewer is entitled
    // to see it (VIP + mutual read-receipts privacy setting) -- see getConversation.js.
    read?: boolean;
}

export function Screen_conversation({ navigation, route }: { navigation: any, route: any }) {
    const ajjj=useCallback(bottomsheet_renderBackdrop,[]);
    const { colors } = useTheme();

    const __MAPPER = cacheStorage.CONFIG.get()?.mapper;
    const imageDomain = __MAPPER?.img_domain[0];
    const [getProfile, setProfile] = useState<any>(null);

    const [getConversations, setConversations] = useState<convoInterface[]>([]);
    const [getUser2Deets, setUser2Deets] = useState<any>([]);
    const [getConvoStarter, setConvoStarter] = useState<any>([]);
    const [starterIndex, setStarterIndex] = useState<number>(0);
    const [inputText, setInputText] = useState<string>('');
    const [getInputImageVideo, setInputImageVideo] = useState<Asset[]>([]);
    const [getInputAudio, setInputAudio] = useState<string | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingMs, setRecordingMs] = useState(0);
    const [recordingSamples, setRecordingSamples] = useState<number[]>([]);
    const [voiceNoteLoading, setVoiceNoteLoading] = useState(false);
    const [audioPlayback, setAudioPlayback] = useState<{ id: string | null, position: number, duration: number, isPlaying: boolean }>({ id: null, position: 0, duration: 0, isPlaying: false });
    const inputTextRef = useRef<TextInput>(null);
    const [isUploadingMedia, setIsUploadingMedia] = useState(false);
    const [reloadIfRealtimeData_File, setReloadIfRealtimeData_File] = useState<boolean>(false);
    const [peerTyping, setPeerTyping] = useState<boolean>(false);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isTypingRef = useRef(false);
    // Read via ref (not state) inside the socket listener below -- that listener is
    // registered once per matchId and closes over whatever getProfile was AT THAT TIME,
    // which is usually still null (profile loads via a separate, later effect). A ref
    // always reads the current value regardless of when the closure was created.
    const myUserIdRef = useRef<string | null>(null);

    const bottomSheet_convotools = {
        ref: useRef<BottomSheet>(null), snap: useMemo(() => ['35%'], [])
    };
    const [getFullscreenClickImage, setFullscreenClickImage] = useState<any | null>(null);
    const autoStopRecordingRef = useRef(false);
    const isRecordingRef = useRef(false);
    const audioPlayingRef = useRef(false);
    const starterCarouselRef = useRef<FlatList<string>>(null);
    const starterViewConfig = useRef({ viewAreaCoveragePercentThreshold: 60 }).current;
    const starterViewable = useRef(({ viewableItems }: { viewableItems: any[] }) => {
        if (viewableItems?.[0]?.index != null) {
            setStarterIndex(viewableItems[0].index);
        }
    }).current;


    useEffect(() => {
        isRecordingRef.current = isRecording;
    }, [isRecording]);
    useEffect(() => {
        audioPlayingRef.current = audioPlayback.isPlaying;
    }, [audioPlayback.isPlaying]);

    // update from realtimedata root app
    useEffect(() => {
        const routeRetrivedData = route?.params?.realtimedata;
        if (routeRetrivedData?.lastMessage === ">>>photo" || routeRetrivedData?.lastMessage === ">>>audio") { setReloadIfRealtimeData_File((prev) => !prev); return; }
        if (routeRetrivedData?.lastMessage) {
            setConversations([{
                messageId: help.randomAlphanumeric(29),
                fromMe: false,
                type: "text",
                message: routeRetrivedData?.lastMessage,
                src: null,
            }, ...getConversations]);
        }
    }, [route?.params?.realtimedata])

    // Live presence dot: join this match's socket room so the server can tell us
    // whether the other participant is also in the conversation right now.
    useEffect(() => {
        const matchId = route.params?.matchId;
        if (!matchId) return;

        const listenerId = `conversation-presence-${matchId}`;

        SocketClient.addListener(listenerId, (data: any) => {
            switch (data?.event) {
                case 'connect':
                    // Rejoin on reconnect -- the server-side room membership was dropped.
                    // Still needed even without a presence indicator: typing/read-receipt
                    // events only reach sockets that are in the match-{matchId} room.
                    SocketClient.socketEmit('join-match-room', { matchId });
                    break;
                case 'disconnect':
                case 'connect_error':
                    setPeerTyping(false);
                    break;
                case 'peer-left':
                    if (data.matchId === matchId) setPeerTyping(false);
                    break;
                case 'peer-typing':
                    if (data.matchId === matchId) setPeerTyping(true);
                    break;
                case 'peer-stop-typing':
                    if (data.matchId === matchId) setPeerTyping(false);
                    break;
                case 'messages-read':
                    // readByUserId is whoever just DID the reading. Both participants'
                    // sockets sit in this room, so without this check my own "I opened
                    // the conversation" read-pass would broadcast back to me and get
                    // mistaken for "my sent messages just got read" -- flipping my own
                    // outgoing messages to read=true regardless of the other side's
                    // actual read state. Only apply when it was the OTHER person reading.
                    if (data.matchId === matchId && data.readByUserId !== myUserIdRef.current) {
                        setConversations((prev) => {
                            // Only flip messages if we already know (from the last real
                            // getConversation fetch) that we're entitled to see receipts at
                            // all -- otherwise this optimistic update would show checkmarks
                            // to a non-VIP/receipts-off viewer ahead of the server's own gate.
                            const entitled = prev.some((m) => typeof m.read === 'boolean');
                            if (!entitled) return prev;
                            return prev.map((m) => (m.fromMe ? { ...m, read: true } : m));
                        });
                    }
                    break;
                case 'message-deleted':
                    if (data.matchId === matchId) {
                        setConversations((prev) => prev.map((m) => (m.messageId === data.convoId
                            ? { ...m, type: 'deleted', message: null, src: null }
                            : m)));
                    }
                    break;
            }
        });

        if (SocketClient.isConnected()) {
            SocketClient.socketEmit('join-match-room', { matchId });
        }

        return () => {
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            if (isTypingRef.current) {
                isTypingRef.current = false;
                SocketClient.socketEmit('stop-typing', { matchId });
            }
            SocketClient.socketEmit('leave-match-room', { matchId });
            SocketClient.removeListener(listenerId);
        };
    }, [route.params?.matchId]);

    // Emits 'typing' at most once per typing "burst" and auto-emits 'stop-typing'
    // after a short pause, so the peer's indicator doesn't get stuck on if the
    // sender stops typing without sending (or backgrounds the app).
    const handleTextChange = (text: string) => {
        setInputText(text);
        const matchId = route.params?.matchId;
        if (!matchId) return;

        if (text.trim().length > 0) {
            if (!isTypingRef.current) {
                isTypingRef.current = true;
                SocketClient.socketEmit('typing', { matchId });
            }
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
                isTypingRef.current = false;
                SocketClient.socketEmit('stop-typing', { matchId });
            }, 2500);
        } else if (isTypingRef.current) {
            isTypingRef.current = false;
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            SocketClient.socketEmit('stop-typing', { matchId });
        }
    };

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

    useEffect(() => {
        myUserIdRef.current = getProfile?.profile?.id ?? null;
    }, [getProfile]);

    const handleInsertPrompt = (text: string) => {
        setInputText(text);
        inputTextRef.current?.focus();
    };

    const formatDurationLabel = (value?: number | null) => {
        if (value == null || Number.isNaN(value)) return '00:00:00';
        // Sound.* listeners already emit millisecond positions; avoid re-scaling to keep times accurate.
        const ms = Math.max(0, Math.floor(value));
        return Sound.mmssss(ms);
    };
    const formatDurationShort = (ms?: number | null) => {
        if (!ms || ms < 0) return null;
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${String(seconds).padStart(2, '0')}`;
    };
    const formatBytes = (bytes?: number | null) => {
        if (!bytes || bytes <= 0) return null;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
        const value = bytes / Math.pow(1024, i);
        return `${value.toFixed(value >= 10 ? 0 : 1)} ${sizes[i]}`;
    };
    const buildPlaybackLabels = (positionMs: number, durationMs?: number | null) => {
        const safePos = Math.max(0, positionMs || 0);
        const safeDuration = durationMs != null ? Math.max(0, durationMs) : null;
        const posLabel = formatDurationShort(safePos) ?? formatDurationLabel(safePos);
        const durationLabel = safeDuration ? (formatDurationShort(safeDuration) ?? formatDurationLabel(safeDuration)) : null;
        const remainingMs = safeDuration != null ? Math.max(safeDuration - safePos, 0) : null;
        const remainingLabel = remainingMs != null ? (formatDurationShort(remainingMs) ?? formatDurationLabel(remainingMs)) : null;
        return { posLabel, durationLabel, remainingLabel };
    };
    const buildStaticWaveBars = (seedKey: string, ratio: number) => {
        const hash = hashString(seedKey);
        const progressRatio = clamp01(ratio);
        return Array.from({ length: CONFIG.AUDIO_WAVE_BARS }, (_, idx) => {
            const angle = (idx + 1) * 0.73 + (hash % 37);
            const intensity = Math.abs((Math.sin(angle) * 0.72) + (Math.cos(angle * 1.7) * 0.28));
            const height = 4 + Math.round(intensity * 14);
            const cutoff = (idx + 1) / CONFIG.AUDIO_WAVE_BARS;
            return {
                key: `${seedKey}-${idx}`,
                height,
                active: progressRatio >= cutoff,
            };
        });
    };
    const normalizeWaveSamples = (samples: number[], min = CONFIG.AUDIO_WAVE_BARS) => {
        const safe = (samples ?? []).map((v) => clamp01(v));
        if (safe.length >= min) return safe.slice(-min);
        const padded = [...safe];
        while (padded.length < min) {
            const idx = padded.length;
            const placeholder = 0.22 + (Math.abs(Math.sin(idx * 0.6)) * 0.18);
            padded.unshift(placeholder);
        }
        return padded;
    };

    const resolveMediaUri = (srcItem?: any) => {
        if (!srcItem) return null;
        const rawUri = typeof srcItem === 'string' ? srcItem : (srcItem?.p ?? srcItem?.uri ?? srcItem?.path);
        if (!rawUri) return null;

        if (rawUri.startsWith('http') || rawUri.startsWith('file:') || rawUri.startsWith('content:')) {
            return rawUri;
        }


        if (rawUri.startsWith('/')) {
            return `${imageDomain}${rawUri}`;
        }

        return rawUri;
    };
    const normalizeFileUri = (path: string) => (path.startsWith('file://') ? path : `file://${path}`);
    const stripFileScheme = (path: string) => (path.startsWith('file://') ? path.slice(7) : path);
    const resolvePlaybackUri = (rawUri?: string | null) => {
        if (!rawUri) return null;
        const normalized = resolveMediaUri(rawUri);
        if (!normalized) return null;
        if (normalized.startsWith('http') || normalized.startsWith('file:') || normalized.startsWith('content:')) {
            return normalized;
        }
        return `${imageDomain}${normalized}`;
    };

    const requestAudioPermission = async () => {
        if (Platform.OS !== 'android') return true;
        try {
            const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
                {
                    title: 'Microphone permission',
                    message: 'We need microphone access so you can send voice notes.',
                    buttonPositive: 'Allow',
                    buttonNegative: 'Cancel',
                }
            );
            if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                Toastx.show({ message: 'Microphone permission is required to record.', type: 'info' });
                return false;
            }
            return true;
        } catch {
            Toastx.show({ message: 'Unable to request microphone permission.', type: 'error' });
            return false;
        }
    };


    // Update the startVoiceNote function with better error handling:
    const startVoiceNote = async () => {
        if (isRecording || voiceNoteLoading) return;

        setVoiceNoteLoading(true);
        setInputAudio(null);
        setRecordingMs(0);
        setRecordingSamples([]);
        autoStopRecordingRef.current = false;

        const granted = await requestAudioPermission();
        if (!granted) {
            setVoiceNoteLoading(false);
            return;
        }

        try {
            // Clear any existing listeners
            Sound.removeRecordBackListener();

            Sound.setSubscriptionDuration?.(0.1);

            // Add listener with proper error handling
            Sound.addRecordBackListener((e) => {
                const currentPosition = Math.max(0, Math.floor(e?.currentPosition ?? 0));
                setRecordingMs(currentPosition);

                const meteringSample = normalizeMetering((e as any)?.currentMetering ?? (e as any)?.metering);
                const fallbackSample = 0.25 + (Math.abs(Math.sin((currentPosition + 40) / 210)) * 0.6);
                setRecordingSamples((prev) => {
                    const next = [...prev, meteringSample ?? fallbackSample];
                    return next.slice(-CONFIG.AUDIO_WAVE_BARS);
                });

                if (!autoStopRecordingRef.current && currentPosition >= CONFIG.MAX_RECORDING_MS) {
                    autoStopRecordingRef.current = true;
                    stopVoiceNote(true);
                    Toastx.show({
                        message: 'Voice note capped at 3:00',
                        type: 'info'
                    });
                }
            });

            const recordPath = Platform.OS === 'android'
                ? `${RNFS.CachesDirectoryPath}/voice_note_${Date.now()}.m4a`
                : undefined;

            await Sound.startRecorder(
                recordPath,
                {
                    AudioSourceAndroid: AudioSourceAndroidType.MIC,
                    OutputFormatAndroid: Platform.OS === 'android' ? OutputFormatAndroidType.MPEG_4 : undefined,
                    AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
                    AudioSamplingRate: 44100,
                    AudioEncodingBitRate: 128000,
                    AudioChannels: 1,
                    AVModeIOS: 'spokenAudio',
                    AVSampleRateKeyIOS: 44100,
                    AVNumberOfChannelsKeyIOS: 1,
                    AVEncoderAudioQualityKeyIOS: AVEncoderAudioQualityIOSType.high,
                },
                true
            );

            setIsRecording(true);
        } catch (error: any) {
            logReport({
                type: "function -convo",
                useraction: "startVoiceNote",
                logMessage: 'Error starting recorder:',
                stackTrace: error
            });
            // Clean up on error
            Sound.removeRecordBackListener();
            setIsRecording(false);
            setRecordingSamples([]);
            autoStopRecordingRef.current = false;

            if (error?.message?.includes('permission')) {
                Toastx.show({
                    message: 'Microphone permission required',
                    type: 'error'
                });
            } else {
                Toastx.show({
                    message: 'Unable to start recording',
                    type: 'error'
                });
            }
        } finally {
            setVoiceNoteLoading(false);
        }
    };

    const stopVoiceNote = async (keep: boolean = true) => {
        if (!isRecording) return;

        setVoiceNoteLoading(true);

        try {
            // Remove listener first to prevent any callbacks during stop
            Sound.removeRecordBackListener();

            // Stop the recorder
            let path = await Sound.stopRecorder();

            setIsRecording(false);

            if (keep && path) {
                if (Platform.OS === 'android' && path.endsWith('.mp4')) {
                    const rawPath = stripFileScheme(path);
                    const m4aPath = rawPath.replace(/\.mp4$/i, '.m4a');
                    try {
                        await RNFS.moveFile(rawPath, m4aPath);
                        path = normalizeFileUri(m4aPath);
                    } catch {
                        path = normalizeFileUri(rawPath);
                    }
                }
                const normalized = (path.startsWith('file://') || path.startsWith('content://'))
                    ? path
                    : normalizeFileUri(path);
                setInputAudio(normalized);
            } else {
                setInputAudio(null);
                setRecordingMs(0);
                setRecordingSamples([]);
            }
        } catch (error: any) {
            logReport({
                type: "function -convo",
                useraction: "stopVoiceNote",
                logMessage: 'Error stopping recorder:',
                stackTrace: error
            });
            // Handle specific error cases
            if (error?.message?.includes('Recorder not started') ||
                error?.message?.includes('path is unavailable')) {
                // Just clean up state without throwing error
                setIsRecording(false);
                setInputAudio(null);
                setRecordingMs(0);
                setRecordingSamples([]);
                Toastx.show({
                    message: 'Recording was interrupted',
                    type: 'info'
                });
            } else {
                Toastx.show({
                    message: 'Unable to stop recording',
                    type: 'error'
                });
            }
        } finally {
            autoStopRecordingRef.current = false;
            setVoiceNoteLoading(false);
        }
    };

    // Update the clearVoiceNote function:
    const clearVoiceNote = async () => {
        if (isRecording) {
            await stopVoiceNote(false);
        } else {
            setInputAudio(null);
            setRecordingMs(0);
            setRecordingSamples([]);
        }
    };

    // Update the toggleVoiceNote function to prevent race conditions:
    const toggleVoiceNote = async () => {
        if (voiceNoteLoading) return;

        if (isRecording) {
            await stopVoiceNote(true);
        } else {
            await startVoiceNote();
        }
    };



    const funt = {
        matchId: route.params?.matchId,
        convoTools: (<>
            <View>
                <Pressable onPress={() => {
                    bottomSheet_convotools?.ref?.current?.close();
                    handleInsertPrompt("Let's plan a quick coffee this week? What day works for you.");
                }} style={{ paddingHorizontal: 10, paddingVertical: 15, flexDirection: "row", alignItems: "center" }}>
                    <IonIcon name="sparkles-outline" size={20} color={colors.accent} />
                    <Text style={{ fontSize: 16, marginLeft: 10 }}>Plan a date idea</Text>
                </Pressable>
                <Pressable onPress={() => {
                    bottomSheet_convotools?.ref?.current?.close();
                    navigation.push(namer.navigation.peoplesOnePerson, { alreadyLiked: true, likedMatchedId: funt.matchId, getOnePersonId: getUser2Deets?.uid, });
                }} style={{ paddingHorizontal: 10, paddingVertical: 15, flexDirection: "row", alignItems: "center" }}>
                    <IonIcon name="person-outline" size={20} color={colors.accent} />
                    <Text style={{ fontSize: 16, marginLeft: 10 }}>View Profile</Text>
                </Pressable>
                <Pressable onPress={async () => {
                    function showConfirmAlert() {
                        return new Promise((resolve) => {
                            Alert.alert(
                                "Block this person?",
                                "Blocking this person prevents them from ever seeing your profile or message you!", // Message
                                [
                                    { text: "No", onPress: () => { resolve(false); }, style: "cancel", },
                                    { text: "Block", onPress: () => { resolve(true); }, },
                                ],
                                { cancelable: false }
                            );
                        });
                    }
                    if (await showConfirmAlert() === true) {
                        Loaderx.show();

                        await _http_request({
                            customApiUrl: __CONFIG__.HTTPS_API_DOMAIN + "/api/core/v1/pushPeopleToMatch",
                            reqType: 'POST', bodyArray: {
                                match_status: 3,
                                matchId: funt.matchId,
                            }
                        }).then(() => {
                            bottomSheet_convotools?.ref?.current?.close();
                            navigation.goBack();
                        });
                    }
                }} style={{ paddingHorizontal: 10, paddingVertical: 15, flexDirection: "row", alignItems: "center" }}>
                    <IonIcon name="ban-outline" size={20} color={colors.accent} />
                    <Text style={{ fontSize: 16, marginLeft: 10 }}>Block User</Text>
                </Pressable>
                {/*<Pressable onPress={() => { bottomSheetRef_convotools.current?.close(); navigation.navigate("ReportUser", { userId: getUser2Deets?.u2id }); }}
                    style={{ paddingHorizontal: 10, paddingVertical: 15, flexDirection: "row", alignItems: "center" }}>
                    <IonIcon name="warning-outline" size={20} color={colors.accent} />
                    <Text style={{ fontSize: 16, marginLeft: 10 }}>Report User</Text>
                </Pressable>*/}
            </View></>),

        isLocalFile: (item: any) => {
            if (!item) return false;
            const uri = item.uri || item.p;
            return typeof uri === "string" && uri.startsWith("file://");
        }
    };

    type UploadDescriptor = {
        uri: string;
        name: string;
        type: string;
        mediaType: 'img' | 'video' | 'audio';
        meta: {
            w?: number | null;
            h?: number | null;
            size?: number | null;
            d?: number | null;
            original?: string | null;
        };
    };

    type UploadedMedia = {
        mediaType: UploadDescriptor['mediaType'];
        src: {
            p: string;
            w?: number | null;
            h?: number | null;
            size?: number | null;
            d?: number | null;
            original?: string | null;
        };
    };


    const buildUploadTarget = (rawName: string | null | undefined, mediaType: UploadDescriptor['mediaType']) => {
        const fallbackExt = mediaType === 'audio'
            ? 'm4a'
            : (mediaType === 'video' ? 'mp4' : 'jpg');

        // Generate a unique name (the server will create the full path)
        const generatedName = `${funt.matchId}_${Date.now()}_${help.randomAlphanumeric(30, 7)}`;
        const finalName = mediaType === 'audio'
            ? `${generatedName}.m4a`
            : `${generatedName}.${fallbackExt}`;

        // We no longer need to build the full path, just return the filename
        // The server will construct the full path based on bucketType
        return {
            name: finalName,
        };
    };



    const uploadWithPresigned = async (descriptor: UploadDescriptor): Promise<UploadedMedia> => {
        try {
            let contentType = descriptor.type;
            if (descriptor.mediaType === 'audio' && descriptor.name.endsWith('.mp4')) {
                contentType = 'audio/mp4';
            }

            const extension = descriptor.name.split('.').pop() || '';
            let bucketType = '';
            if (descriptor.mediaType === 'img') bucketType = 'convo-img';
            else if (descriptor.mediaType === 'video') bucketType = 'convo-video';
            else if (descriptor.mediaType === 'audio') bucketType = 'convo-audio';

            const presigned = await uploadHandler.requestPresignedURL_Upload(
                extension,
                bucketType,
                funt.matchId
            );

            // Add timeout and better error handling
            const uploadOptions = {
                toUrl: presigned.uploadUrl,
                files: [{
                    name: "file",
                    filename: descriptor.name,
                    filepath: descriptor.uri.replace("file://", ""),
                    filetype: contentType
                }],
                method: presigned.method || "PUT",
                headers: { "Content-Type": contentType },
                binaryStreamOnly: true,
                begin: (response: any) => {
                    console.log('Upload began:', response);
                },
                progress: (response: any) => {
                    const percentage = (response.totalBytesSent / response.totalBytesExpectedToSend) * 100;
                    console.log(`Upload progress: ${Math.round(percentage)}%`);
                },
            };

            // Add timeout promise
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Upload timeout after 60 seconds')), 160000);// ~ 2mins
            });

            const uploadPromise = RNFS.uploadFiles(uploadOptions).promise;
            const uploadResult = (await Promise.race([uploadPromise, timeoutPromise])) as any;

            if (uploadResult.statusCode < 200 || uploadResult.statusCode >= 300) {
                throw new Error(`Upload failed: ${uploadResult.statusCode}`);
            }

            const encodedPath = "/" + uploadHandler.joinPath(presigned.bucket, presigned.fileKey);
            return {
                mediaType: descriptor.mediaType,
                src: {
                    p: encodedPath,
                    w: descriptor.meta.w ?? null,
                    h: descriptor.meta.h ?? null,
                    size: descriptor.meta.size ?? null,
                    d: descriptor.meta.d ?? null,
                },
            };
        } catch (error) {
            logReport({
                url: "presigned?.uploadUrl",
                type: "http -convo",
                useraction: "uploadWithPresigned",
                logMessage: 'Upload error on slow network',
                stackTrace: error
            });
            console.log(error)
            throw error;
        }
    };

    useEffect(() => {
        Loaderx.show();
        // get convo
        (async () => {
            await _http_request({
                customApiUrl: __CONFIG__.HTTPS_API_DOMAIN + "/api/core/v1/getConversation",
                reqType: 'POST', bodyArray: {
                    matchID: funt.matchId,
                }
            }).then((response) => {
                if (response?.code === 200) {
                    setConversations(response?.chatsMessageListings?.reverse() ?? getConversations);
                    setUser2Deets(response?.u2deets ?? getUser2Deets);
                    setConvoStarter(response?.convostarter ?? getConvoStarter);

                    navigationRef.setParams({ matchId: funt.matchId });

                } else if (response !== null) {
                    Alert.alert('Error!', response?.message);
                    logReport({
                        type: "http -" + response.code,
                        useraction: "getConversation",
                        logMessage: response?.message ?? 'Failed to fetch conversation',
                        stackTrace: response
                    });
                }
            }).finally(() => {
                setTimeout(() => {
                    Loaderx.hide();
                }, 1000);
            });
        })();

        return () => {

        }
    }, [reloadIfRealtimeData_File]);

    // Update the useEffect cleanup:
    useEffect(() => {
        return () => {
            // Use a timeout to ensure any pending operations complete
            setTimeout(() => {
                try {
                    if (isRecordingRef.current) {
                        Sound.stopRecorder().catch(() => { });
                    }
                    if (audioPlayingRef.current) {
                        Sound.stopPlayer().catch(() => { });
                    }
                } catch { }

                Sound.removeRecordBackListener();
                Sound.removePlayBackListener();
                Sound.removePlaybackEndListener();
            }, 100);
        };
    }, []);

    // Add a function to safely handle audio cleanup
    const safeStopAllAudio = async () => {
        try {
            // Stop recording if active
            if (isRecording) {
                await Sound.stopRecorder().catch(() => { });
                setIsRecording(false);
                setRecordingSamples([]);
            }

            // Stop playback if active
            if (audioPlayback.id) {
                await Sound.stopPlayer().catch(() => { });
                setAudioPlayback({
                    id: null,
                    position: 0,
                    duration: 0,
                    isPlaying: false
                });
            }

            // Remove all listeners
            Sound.removeRecordBackListener();
            Sound.removePlayBackListener();
            Sound.removePlaybackEndListener();
        } catch (error) {
            logReport({
                type: "function -convo",
                useraction: "safeStopAllAudio",
                logMessage: 'Error in safeStopAllAudio: Failed to stop audio',
                stackTrace: error
            })
        }
    };

    // Update the audio playback function with better error handling:
    const handleAudioPress = async (messageId: string, uri?: string | null) => {
        const playbackUri = resolvePlaybackUri(uri ?? null);
        if (!playbackUri) {
            Toastx.show({
                message: 'Audio file not available',
                type: 'info'
            });
            return;
        }

        // If same audio is playing, pause it
        if (audioPlayback.id === messageId && audioPlayback.isPlaying) {
            try {
                await Sound.pausePlayer();
                setAudioPlayback(prev => ({ ...prev, isPlaying: false }));
            } catch (error) {
                logReport({
                    type: "function -convo",
                    useraction: "handleAudioPress",
                    logMessage: 'Error pausing player',
                    stackTrace: error
                });
                setAudioPlayback({ id: null, position: 0, duration: 0, isPlaying: false });
            }
            return;
        }

        // If different audio, stop current and play new
        try {
            await safeStopAllAudio();

            await Sound.startPlayer(playbackUri);
            setAudioPlayback({
                id: messageId,
                position: 0,
                duration: 0,
                isPlaying: true
            });

            Sound.addPlayBackListener((e) => {
                setAudioPlayback({
                    id: messageId,
                    position: e.currentPosition ?? 0,
                    duration: e.duration ?? 0,
                    isPlaying: true
                });
            });

            Sound.addPlaybackEndListener(() => {
                setAudioPlayback({
                    id: null,
                    position: 0,
                    duration: 0,
                    isPlaying: false
                });
            });

        } catch (error) {
            logReport({
                type: "function -convo",
                useraction: "handleAudioPress",
                logMessage: "Error playing audio",
                stackTrace: error
            });
            Toastx.show({
                message: 'Unable to play audio',
                type: 'error'
            });
            setAudioPlayback({ id: null, position: 0, duration: 0, isPlaying: false });
        }
    };



    useLayoutEffect(() => {
        navigation.setOptions({
            headerStyle: { backgroundColor: colors.background },
            headerShadowVisible: false,
            headerTitleAlign: 'left',
            headerTitle: () => <View style={{ alignItems: "center", flexDirection: "row", gap: 5 }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', textTransform: "capitalize" }}>{getUser2Deets?.fullname}</Text> 
                {getUser2Deets?.verified ? <IonIcon name="checkmark-done-circle-sharp" size={20} color={colors.accent} /> : <></>}
            </View>,

            headerRight: () => <View style={{ paddingRight: 5, flexDirection: "row", alignItems: "center", gap: 18 }}>

                {/* Voice Call */}
                <Pressable
                    style={{ padding: 4 }}
                    onPress={() => {
                        Toastx.show({ message: "voice call coming soon", type: "success" });
                    }} >
                    <IonIcon name="call-outline" size={25} color={colors.accent} />
                </Pressable>

                {/* Video Call */}
                <Pressable
                    style={{ padding: 4 }}
                    onPress={() => {
                        Toastx.show({ message: "Video call coming soon", type: "success" });
                    }} >
                    <IonIcon name="videocam-outline" size={26} color={colors.accent} />
                </Pressable>

                {/* More Options */}
                <Pressable
                    style={{ padding: 4 }}
                    onPress={() => {
                        bottomSheet_convotools.ref.current?.expand();
                    }}
                >
                    <IonIcon name="ellipsis-horizontal" size={25} color={colors.accent} />
                </Pressable>

            </View>

        });
    }, [getUser2Deets]);



    // Tells the peer's socket room a new message arrived (best-effort toast on their side).
    const notifyPeerRealtime = (lastMessage: string) => {
        const jy = getProfile?.profile?.fullname ?? "";
        if (!getUser2Deets?.uid) return;
        SocketClient.emit("/pushUser/" + getUser2Deets?.uid, {
            matchId: funt.matchId,
            type: "single-convo",
            payload: {
                firstName: (jy.split(" ")?.[0]) ?? jy,
                lastMessage,
            }
        });
    };

    // Sends (or resends) a single text bubble. Independent of any other bubble in
    // the batch -- one failing doesn't affect the others, and each can be retried
    // on its own by tapping it.
    const attemptSendText = async (msg: convoInterface) => {
        setConversations((prev) => prev.map((m) => (m.messageId === msg.messageId ? { ...m, status: 'sending' } : m)));
        try {
            const response = await _http_request({
                customApiUrl: __CONFIG__.HTTPS_API_DOMAIN + "/api/core/v1/pushConversation",
                reqType: 'POST',
                bodyArray: { messagee: msg.message, match_id: funt.matchId }
            });
            if (response?.code === 200) {
                setConversations((prev) => prev.map((m) => (m.messageId === msg.messageId ? { ...m, status: undefined } : m)));
                notifyPeerRealtime(msg.message ?? '');
            } else {
                setConversations((prev) => prev.map((m) => (m.messageId === msg.messageId ? { ...m, status: 'failed' } : m)));
            }
        } catch (error) {
            logReport({ type: "function -convo", useraction: "attemptSendText", logMessage: 'Send message error: ', stackTrace: error });
            setConversations((prev) => prev.map((m) => (m.messageId === msg.messageId ? { ...m, status: 'failed' } : m)));
        }
    };

    // Sends (or resends) a single media bubble. `msg.src` still holds the local
    // file:// uri(s) until a send actually succeeds (success overwrites them with
    // the uploaded server path), so a failed/retried bubble always has what it
    // needs to re-upload from scratch.
    const attemptSendMedia = async (msg: convoInterface) => {
        setConversations((prev) => prev.map((m) => (m.messageId === msg.messageId ? { ...m, status: 'sending', isUploading: true } : m)));
        const mediaType: UploadDescriptor['mediaType'] = msg.type === 'audio' ? 'audio' : (msg.type === 'video' ? 'video' : 'img');
        try {
            const uploaded: UploadedMedia[] = [];
            for (const srcItem of (msg.src ?? [])) {
                if (!srcItem?.p) continue;
                const { name } = buildUploadTarget(srcItem?.original ?? null, mediaType);
                uploaded.push(await uploadWithPresigned({
                    uri: srcItem.p,
                    name,
                    type: mediaType === 'audio' ? 'audio/m4a' : (mediaType === 'video' ? 'video/mp4' : 'image/jpeg'),
                    mediaType,
                    meta: { w: srcItem.w ?? null, h: srcItem.h ?? null, size: srcItem.size ?? null, d: srcItem.d ?? null, original: srcItem.original ?? null },
                }));
            }

            const file_meta = uploaded.map((item) => ({
                url: item.src.p, path: item.src.p, w: item.src.w ?? null, h: item.src.h ?? null,
                size: item.src.size ?? null, d: item.src.d ?? null, original: item.src.original ?? null,
            }));

            const response = await _http_request({
                customApiUrl: __CONFIG__.HTTPS_API_DOMAIN + "/api/core/v1/pushConversation",
                reqType: 'POST',
                bodyArray: { match_id: funt.matchId, file_meta }
            });

            if (response?.code === 200) {
                setConversations((prev) => prev.map((m) => (m.messageId === msg.messageId
                    ? { ...m, src: uploaded.map((u) => u.src), status: undefined, isUploading: false }
                    : m)));
                notifyPeerRealtime(mediaType === 'video' ? '>>>video' : (mediaType === 'img' ? '>>>photo' : '>>>audio'));
            } else {
                setConversations((prev) => prev.map((m) => (m.messageId === msg.messageId ? { ...m, status: 'failed', isUploading: false } : m)));
            }
        } catch (error) {
            logReport({ type: "function -convo", useraction: "attemptSendMedia", logMessage: 'Send/retry media error', stackTrace: error });
            setConversations((prev) => prev.map((m) => (m.messageId === msg.messageId ? { ...m, status: 'failed', isUploading: false } : m)));
        }
    };

    const retryMessage = (item: convoInterface) => {
        if (item.status !== 'failed') return;
        if (item.type === 'text') attemptSendText(item);
        else attemptSendMedia(item);
    };

    // Long-press-to-delete, sender's own messages only. A 'failed' message was never
    // actually persisted (the insert never happened), so it's a pure local removal;
    // anything else calls the real delete endpoint and swaps in a "Text deleted" bubble.
    const deleteMessage = (item: convoInterface) => {
        if (!item.fromMe || item.type === 'deleted') return;

        Alert.alert(
            'Delete this message?',
            "This can't be undone.",
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete', style: 'destructive', onPress: async () => {
                        if (item.status === 'failed') {
                            setConversations((prev) => prev.filter((m) => m.messageId !== item.messageId));
                            return;
                        }
                        try {
                            const response = await _http_request({
                                customApiUrl: __CONFIG__.HTTPS_API_DOMAIN + "/api/core/v1/pushDeleteMessage",
                                reqType: 'POST',
                                bodyArray: { convoId: item.messageId }
                            });
                            if (response?.code === 200) {
                                setConversations((prev) => prev.map((m) => (m.messageId === item.messageId
                                    ? { ...m, type: 'deleted', message: null, src: null }
                                    : m)));
                            } else {
                                Toastx.show({ type: 'error', message: response?.message ?? 'Unable to delete message.' });
                            }
                        } catch (error) {
                            logReport({ type: "function -convo", useraction: "deleteMessage", logMessage: 'Delete message error', stackTrace: error });
                            Toastx.show({ type: 'error', message: 'Unable to delete message.' });
                        }
                    }
                },
            ]
        );
    };

    const sendMessage = async (presetText?: string) => {
        if (isUploadingMedia) return;

        const messageText = (presetText ?? inputText).trim();
        const hasMedia = getInputImageVideo.length > 0;
        const hasAudio = Boolean(getInputAudio);
        const hasText = messageText.length > 0;

        if (!hasMedia && !hasAudio && !hasText) {
            return;
        }

        const uploadDescriptors: UploadDescriptor[] = [];

        // Process images/videos
        getInputImageVideo.forEach((file, index) => {
            const mediaType: UploadDescriptor['mediaType'] = (file.type ?? '').startsWith('video') ? 'video' : 'img';
            if (!file.uri) return;
            uploadDescriptors.push({
                uri: file.uri,
                name: `media_${index}`,
                type: file.type ?? (mediaType === 'video' ? 'video/mp4' : 'image/jpeg'),
                mediaType,
                meta: {
                    w: file.width ?? null,
                    h: file.height ?? null,
                    size: file.fileSize ?? null,
                    d: file.duration ? file.duration * 1000 : null,
                    original: file.fileName ?? null,
                },
            });
        });

        // Process audio
        if (hasAudio && getInputAudio) {
            uploadDescriptors.push({
                uri: getInputAudio,
                name: getInputAudio.split('/').pop() ?? `voice_note_${Date.now()}.m4a`,
                type: 'audio/m4a',
                mediaType: 'audio',
                meta: {
                    d: recordingMs,
                    size: null,
                    original: getInputAudio.split('/').pop() ?? null,
                },
            });
        }

        // Prepare optimistic messages with local data -- src holds the LOCAL uri
        // until attemptSendMedia successfully uploads it, which is also what lets
        // a failed send retry from the same local file.
        let outgoingMessages: convoInterface[] = [];

        if (uploadDescriptors.length > 0) {
            const imagesVideos = uploadDescriptors.filter((d) => d.mediaType === 'img' || d.mediaType === 'video');
            const audios = uploadDescriptors.filter((d) => d.mediaType === 'audio');

            if (imagesVideos.length > 0) {
                const hasVideo = imagesVideos.some(d => d.mediaType === 'video');
                outgoingMessages.push({
                    messageId: help.randomAlphanumeric(29),
                    fromMe: true,
                    type: hasVideo ? "video" : "image",
                    message: null,
                    src: imagesVideos.map((d) => ({ p: d.uri, w: d.meta.w, h: d.meta.h, size: d.meta.size, d: d.meta.d, original: d.meta.original })),
                    isUploading: true,
                    status: 'sending',
                });
            }

            if (audios.length > 0) {
                outgoingMessages.push({
                    messageId: help.randomAlphanumeric(29),
                    fromMe: true,
                    type: "audio",
                    message: null,
                    src: audios.map((d) => ({ p: d.uri, d: d.meta.d, size: d.meta.size, original: d.meta.original })),
                    isUploading: true,
                    status: 'sending',
                });
            }
        }

        // Add text message if exists
        if (messageText.length > 0) {
            outgoingMessages.push({
                messageId: help.randomAlphanumeric(29),
                fromMe: true,
                type: "text",
                message: messageText,
                src: null,
                isUploading: false,
                status: 'sending',
            });
        }

        // Clear input states
        setInputImageVideo([]);
        setInputText('');
        setInputAudio(null);
        setRecordingSamples([]);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        if (isTypingRef.current) {
            isTypingRef.current = false;
            SocketClient.socketEmit('stop-typing', { matchId: funt.matchId });
        }

        // Add optimistic messages to UI
        setConversations((prev) => [...outgoingMessages, ...prev]);
        setIsUploadingMedia(true);

        try {
            await Promise.allSettled(outgoingMessages.map((m) => (m.type === 'text' ? attemptSendText(m) : attemptSendMedia(m))));
        } finally {
            flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
            setRecordingMs(0);
            setIsRecording(false);
            setIsUploadingMedia(false);
        }
    };

    const flatListRef = useRef<FlatList>(null);
    const renderMessage = ({ item }: { item: convoInterface }) => {

        // Handle different message types
        const isImage = item.type === 'image' && item.src && item.src.length > 0;
        const isVideo = item.type === 'video' && item.src && item.src.length > 0;
        const isAudio = item.type === 'audio' && item.src && item.src.length > 0;
        const isText = item.type === 'text';
        const isFile = item.type === 'file' && item.src && item.src.length > 0;
        const isDeleted = item.type === 'deleted';

        const firstSrc = Array.isArray(item?.src) ? item.src?.[0] : null;
        const firstSrcDuration = firstSrc?.d != null ? Number(firstSrc.d) : 0;
        const firstSrcSize = firstSrc?.size != null ? Number(firstSrc.size) : null;

        // Audio playback logic
        const audioUri = isAudio ? resolveMediaUri(firstSrc) : null;
        const isCurrentAudio = audioPlayback.id === item.messageId;
        const durationMs = isCurrentAudio ? (audioPlayback.duration || audioPlayback.position) : firstSrcDuration;
        const playbackPositionMs = isCurrentAudio ? audioPlayback.position : 0;
        const durationFormatted = durationMs ? formatDurationShort(durationMs) : null;
        const playbackLabels = buildPlaybackLabels(playbackPositionMs, durationMs);
        const audioProgressRatio = durationMs > 0 ? clamp01(playbackPositionMs / durationMs) : 0;
        const audioWaveBars = buildStaticWaveBars(item.messageId, audioProgressRatio);
        const audioDisplayLabel = isCurrentAudio && playbackLabels.durationLabel
            ? `${playbackLabels.posLabel} / ${playbackLabels.durationLabel}`
            : (durationFormatted ?? formatDurationLabel(durationMs));

        const fileSizeLabel = formatBytes(firstSrcSize);
        const fileOriginalName = firstSrc?.original;


        return (
            <Pressable
                style={[styles.conversation_message_container, item.fromMe ? styles.conversation_currentUserMessage : styles.conversation_nextUserMessage]}
                onLongPress={item.fromMe ? () => deleteMessage(item) : undefined}
                delayLongPress={400}
            >
                <View style={[styles.conversation_messageBubble, {
                    borderBottomRightRadius: (item.fromMe) ? 0 : 10,
                    borderBottomLeftRadius: (item.fromMe) ? 10 : 0,
                    backgroundColor: (isImage || isVideo) ? "#a1a1a111" : ((item.fromMe) ? colors.surfaceElevated : '#0078fe')
                }]}>
                    {isDeleted && <Text style={[styles.conversation_messageText, {
                        fontStyle: 'italic',
                        color: (item.fromMe) ? colors.textSecondary : "rgba(255,255,255,0.85)"
                    }]}>Message deleted</Text>}

                    {!isDeleted && isText && <Text style={[styles.conversation_messageText, {
                        color: (item.fromMe) ? colors.text : "#fff"
                    }]}>{item?.message}</Text>}

                    {isVideo && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}>
                            <TouchableOpacity disabled={item.isUploading} onPress={() => {
                                const vidUri = resolveMediaUri(firstSrc);
                                if (vidUri) Linking.openURL(vidUri);
                            }} style={{ backgroundColor: item.fromMe ? colors.surfaceElevated : '#1b5ec766', padding: 10, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
                                <MaterialCommunityIcons name="play-circle" size={22} color={item.fromMe ? colors.text : "#fff"} />
                                <Text style={{ color: item.fromMe ? colors.text : "#fff" }}>
                                    {item.isUploading ? 'Uploading Video...' : `Video${fileSizeLabel ? ` | ${fileSizeLabel}` : ''}${durationFormatted ? ` | ${durationFormatted}` : ''}`}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {isFile && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}>
                            <TouchableOpacity onPress={() => {
                                const fileUri = resolveMediaUri(firstSrc);
                                if (fileUri) Linking.openURL(fileUri);
                            }} style={{ backgroundColor: item.fromMe ? colors.surfaceElevated : '#1b5ec766', padding: 10, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
                                <MaterialCommunityIcons name="file" size={20} color={item.fromMe ? colors.text : "#fff"} />
                                <Text style={{ color: item.fromMe ? colors.text : "#fff" }}>
                                    {fileOriginalName ?? 'File'}{fileSizeLabel ? ` | ${fileSizeLabel}` : ''}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {isAudio && (
                        <View style={{ paddingVertical: 4, maxWidth: '100%', minWidth: Math.min(screenWidth * 0.65, 280) }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <TouchableOpacity disabled={item.isUploading} onPress={() => { handleAudioPress(item.messageId, audioUri) }}
                                    style={{
                                        backgroundColor: item.fromMe ? colors.surfaceElevated : 'rgba(255,255,255,0.22)',
                                        width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center",
                                    }}>
                                    <IonIcon name={item.isUploading ? "hourglass" : ((isCurrentAudio && audioPlayback.isPlaying) ? "pause" : "play")}
                                        size={16} color={item.fromMe ? colors.accent : "#fff"} style={{ marginLeft: (isCurrentAudio && audioPlayback.isPlaying) ? 0 : 1 }} />
                                </TouchableOpacity>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 1.5, height: 24, flex: 1 }}>
                                    {audioWaveBars.map((bar) => (
                                        <View key={bar.key} style={{
                                            flex: 1,
                                            maxWidth: 3,
                                            borderRadius: 2,
                                            height: bar.height,
                                            backgroundColor: bar.active
                                                ? (item.fromMe ? colors.accent : '#fff')
                                                : (item.fromMe ? colors.border : 'rgba(255,255,255,0.4)')
                                        }} />
                                    ))}
                                </View>
                                <Text style={{ color: (item.fromMe) ? colors.textSecondary : "#e7f0ff", fontSize: 12, fontVariant: ['tabular-nums'], minWidth: 32, textAlign: 'right' }}>
                                    {item.isUploading ? '...' : audioDisplayLabel}
                                </Text>
                            </View>
                        </View>
                    )}

                    {isImage && (
                        <View style={{ gap: 5 }}>
                            {(item.src ?? []).map((img, key) => {
                                const originalWidth = img?.w ?? 450;
                                const originalHeight = img?.h ?? 600;
                                const targetHeight = 190;
                                const aspectRatio = originalWidth / originalHeight;
                                const targetWidth = Math.min(targetHeight * aspectRatio, screenWidth);

                                let imgPath = img?.p;
                                if (!funt.isLocalFile(img)) {
                                    imgPath = (imageDomain + img?.p) || img?.p;
                                }

                                return (
                                    <Pressable key={key} style={{ gap: 5 }} disabled={item.isUploading} onPress={() => {
                                        setFullscreenClickImage(imgPath);
                                    }}>
                                        <View style={{ position: 'relative' }}>
                                            <SafeImage source={{ cache: FastImage.cacheControl.immutable, uri: imgPath }} style={{ width: targetWidth, height: targetHeight }} resizeMode="contain"
                                                onError={() => { return logReport({ type: "http -image", logMessage: "Image load", url: imgPath, useraction: 'Image Load', stackTrace: null }); }} />
                                            {item.isUploading && (
                                                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
                                                    <Text style={{ color: '#fff', marginTop: 5 }}>Uploading...</Text>
                                                </View>
                                            )}
                                        </View>
                                    </Pressable>
                                );
                            })}
                        </View>
                    )}
                </View>

                {item.status === 'failed' && (
                    <Pressable onPress={() => retryMessage(item)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, alignSelf: item.fromMe ? 'flex-end' : 'flex-start' }}>
                        <IonIcon name="alert-circle" size={14} color="#ff3b30" />
                        <Text style={{ color: '#ff3b30', fontSize: 12 }}>Failed to send -- tap to retry</Text>
                    </Pressable>
                )}
                {item.fromMe && !isDeleted && item.status !== 'failed' && typeof item.read === 'boolean' && (
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 2 }}>
                        <IonIcon name={item.read ? "checkmark-done" : "checkmark"} size={14} color={item.read ? colors.accent : colors.textSecondary} />
                    </View>
                )}
            </Pressable>
        );
    };
    const pendingPlayback = audioPlayback.id === 'pending-audio';
    const pendingPositionMs = pendingPlayback ? audioPlayback.position : recordingMs;
    const pendingDurationMs = pendingPlayback ? (audioPlayback.duration || recordingMs) : recordingMs;
    const pendingProgressRatio = pendingDurationMs > 0 ? clamp01(pendingPositionMs / pendingDurationMs) : 0;
    const pendingLabels = buildPlaybackLabels(pendingPositionMs, pendingDurationMs);
    const pendingTimeLabel = (pendingPlayback && pendingLabels.durationLabel)
        ? `${pendingLabels.posLabel} / ${pendingLabels.durationLabel}`
        : pendingLabels.posLabel;
    const pendingWaveSamples = normalizeWaveSamples(recordingSamples);
    const pendingWaveBars = pendingWaveSamples.map((sample, idx) => ({
        key: `pending-${idx}`,
        height: 4 + Math.round(sample * 14),
        active: isRecording ? true : (((idx + 1) / pendingWaveSamples.length) <= pendingProgressRatio),
    }));

    return (<>
        <SafeAreaView style={[styles.container, {backgroundColor: colors.background }]} edges={['bottom']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }} >

                <View style={{ paddingVertical: 5 }}>
                    <Pressable onPress={() => { navigation.push(namer.navigation.peoplesOnePerson, { alreadyLiked: true, likedMatchedId: funt.matchId, getOnePersonId: getUser2Deets?.uid }); }}
                        style={{ backgroundColor: colors.backgroundSecondary, borderRadius: 14, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <SafeImage source={{ uri: getUser2Deets?.image?.p ? imageDomain + getUser2Deets.image.p : undefined, cache: FastImage.cacheControl.immutable }}
                            style={{ width: 80, height: 80, borderRadius: 50 }} />
                        <View style={{ flex: 1, gap: 4 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                <Text style={{ fontSize: 16, fontWeight: 'bold', textTransform: "capitalize" }}>{getUser2Deets?.fullname || "Your match"}</Text>
                            </View>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                                {getUser2Deets?.city && <Text style={{ color: colors.textSecondary }}><IonIcon name="location-outline" size={14} color={colors.accent} /> {getUser2Deets?.city}</Text>}
                            </View>
                            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Read bio for conversation idea.</Text>
                        </View>
                        <IonIcon name="chevron-forward" size={20} color={colors.accent} />
                    </Pressable>


                </View>

                <FlatList ref={flatListRef} data={getConversations}
                    style={{ flex: 1 }}
                    inverted
                    keyExtractor={item => item.messageId}
                    renderItem={renderMessage}
                    initialNumToRender={4} maxToRenderPerBatch={4} windowSize={4}
                    showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ gap: 10 }}
                    // On an inverted list ListHeaderComponent renders at the visual bottom
                    // (right above the composer), which is where a live typing bubble belongs.
                    ListHeaderComponent={peerTyping ? <TypingBubble /> : null}

                    ListEmptyComponent={<View style={{ paddingVertical: 20, alignItems: "center", width: '100%' }}>
                        <FlatList
                            ref={starterCarouselRef}
                            data={getConvoStarter}
                            keyExtractor={(item, index) => `${item}-${index}`}
                            renderItem={({ item }) => (
                                <Pressable
                                    onPress={() => handleInsertPrompt(item)}
                                    style={{
                                        width: screenWidth * 0.78,
                                        paddingVertical: 16,
                                        paddingHorizontal: 18,
                                        backgroundColor: '#0f172a',
                                        borderRadius: 16,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        shadowColor: '#000',
                                        shadowOpacity: 0.1,
                                        shadowRadius: 10,
                                        shadowOffset: { width: 0, height: 4 },
                                    }}>
                                    <Text style={{ color: '#fff', fontSize: 15, textAlign: 'center', lineHeight: 22 }}>{item}</Text>
                                    <Text style={{ color: '#cbd5e1', fontSize: 12, marginTop: 10 }}>Tap to use this prompt</Text>
                                </Pressable>
                            )}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            pagingEnabled
                            snapToAlignment="center"
                            decelerationRate="fast"
                            onViewableItemsChanged={starterViewable}
                            viewabilityConfig={starterViewConfig}
                            contentContainerStyle={{ paddingHorizontal: ((screenWidth * 0.1) / 2), gap: 10 }}
                        />
                        {Array.isArray(getConvoStarter) && getConvoStarter.length > 1 && (
                            <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
                                {getConvoStarter.map((_: any, idx: number) => (
                                    <View key={idx} style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: 4,
                                        backgroundColor: idx === starterIndex ? colors.accent : colors.border
                                    }} />
                                ))}
                            </View>
                        )}
                    </View>}
                    onLayout={() => {
                        if (flatListRef.current && getConversations.length > 0) {
                            flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
                        }
                    }}
                />

                {getInputImageVideo?.length > 0 && (
                    <View>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={{ marginVertical: 4 }}
                            contentContainerStyle={{
                                gap: 4,
                                paddingHorizontal: 6, // ???????
                                alignItems: 'center'  // ????
                            }}
                        >
                            {getInputImageVideo?.map((ag, index) => {
                                const originalWidth = ag?.width ?? 450;
                                const originalHeight = ag?.height ?? 600;
                                const targetHeight = 190; // uniform display height
                                const aspectRatio = originalWidth / originalHeight;
                                const targetWidth = Math.min(targetHeight * aspectRatio, screenWidth * .8);

                                return (
                                    <Pressable key={index} onPress={() => { if (ag?.uri) setFullscreenClickImage(ag?.uri); }}>
                                        <ImageBackground
                                            style={{
                                                position: 'relative',
                                                borderRadius: 6,
                                                overflow: 'hidden', // ??????
                                                width: targetWidth,
                                                height: targetHeight,
                                            }}
                                            source={{ uri: ag?.uri }} >
                                            <TouchableOpacity
                                                onPress={() => setInputImageVideo((prev) => prev?.filter((_, i) => i !== index))}
                                                style={{
                                                    backgroundColor: 'rgba(0,0,0,0.65)',
                                                    borderRadius: 12,
                                                    width: 24,
                                                    height: 24,
                                                    justifyContent: 'center',
                                                    alignItems: 'center',
                                                    position: 'absolute',
                                                    top: 6,
                                                    right: 6,
                                                    zIndex: 10,
                                                    shadowColor: '#000',
                                                    shadowOffset: { width: 0, height: 2 },
                                                    shadowOpacity: 0.15,
                                                    shadowRadius: 3,
                                                    elevation: 3,
                                                }}
                                            >
                                                <Icon name="close" color="#fff" size={16} />
                                            </TouchableOpacity>
                                        </ImageBackground>
                                    </Pressable>
                                );
                            })}
                        </ScrollView>
                    </View>)}

                {(isRecording || getInputAudio) &&
                    <View style={{
                        marginHorizontal: 6, marginBottom: 8, paddingHorizontal: 10, paddingVertical: 8,
                        borderRadius: 22, backgroundColor: isRecording ? colors.surface : colors.backgroundSecondary,
                        borderWidth: isRecording ? 1 : 0, borderColor: '#ffd6d6',
                        flexDirection: 'row', alignItems: 'center', gap: 10,
                        shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1,
                    }}>
                        <TouchableOpacity onPress={clearVoiceNote} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.backgroundSecondary, alignItems: 'center', justifyContent: 'center' }}>
                            <Icon name="close" size={16} color={colors.textSecondary} />
                        </TouchableOpacity>

                        {isRecording ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <RecordingDot />
                                <Text style={{ color: '#ff3b30', fontSize: 14, fontVariant: ['tabular-nums'], fontWeight: '600', minWidth: 38 }}>
                                    {pendingTimeLabel}
                                </Text>
                            </View>
                        ) : (
                            <TouchableOpacity onPress={() => handleAudioPress('pending-audio', getInputAudio)} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#0078fe', alignItems: 'center', justifyContent: 'center' }}>
                                <IonIcon name={(audioPlayback.id === 'pending-audio' && audioPlayback.isPlaying) ? "pause" : "play"} size={14} color="#fff"
                                    style={{ marginLeft: (audioPlayback.id === 'pending-audio' && audioPlayback.isPlaying) ? 0 : 1 }} />
                            </TouchableOpacity>
                        )}

                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 1.5, height: 22 }}>
                            {pendingWaveBars.map((bar) => (
                                <View key={bar.key} style={{
                                    flex: 1,
                                    maxWidth: 3,
                                    borderRadius: 2,
                                    height: bar.height,
                                    backgroundColor: isRecording ? '#ff3b30' : (bar.active ? '#0078fe' : colors.border)
                                }} />
                            ))}
                        </View>

                        {!isRecording &&
                            <Text style={{ color: colors.textSecondary, fontSize: 12, fontVariant: ['tabular-nums'] }}>{pendingTimeLabel}</Text>
                        }

                        {isRecording &&
                            <TouchableOpacity onPress={() => { stopVoiceNote(true) }} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#ff3b30', alignItems: 'center', justifyContent: 'center' }}>
                                <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: '#fff' }} />
                            </TouchableOpacity>
                        }
                    </View>
                }

                <View style={[styles.conversation_textInputContainer, { marginVertical: 5 }]}>
                    <TouchableOpacity onPress={async () => {
                        const hs = await mediaHandler.handleSelectFromGallery({
                            mediaType: 'photo',
                            includeBase64: false,
                            selectionLimit: Math.max(1, CONFIG.imgSelectUploadLimit - getInputImageVideo.length)
                        });
                        if (hs) {
                            if ((getInputImageVideo.length + hs.length) > CONFIG.imgSelectUploadLimit) {
                                Toastx.show({
                                    message: "You are limited to " + CONFIG.imgSelectUploadLimit + " photos/video",
                                    type: "info"
                                });
                            } else {
                                setInputImageVideo(prev => {
                                    const incoming = (hs || []).filter(
                                        item => !prev.some(p => p.uri === item.uri)
                                    );
                                    return [...prev, ...incoming].slice(0, CONFIG.imgSelectUploadLimit);
                                });
                            }
                        }
                    }} style={{ paddingHorizontal: 6 }}>
                        <MaterialCommunityIcons name="camera" size={25} color={colors.accent} />
                    </TouchableOpacity>
                    <TouchableOpacity disabled={voiceNoteLoading} onPress={() => toggleVoiceNote()} style={{ paddingHorizontal: 6, opacity: voiceNoteLoading ? 0.5 : 1 }}>
                        <MaterialCommunityIcons name={voiceNoteLoading ? "timer-sand" : (isRecording ? "stop-circle" : "microphone")} size={25} color={isRecording ? "#d00" : colors.accent} />
                    </TouchableOpacity>
                    <TextInput
                        ref={inputTextRef}
                        style={styles.conversation_textInput}
                        value={inputText}
                        onChangeText={handleTextChange}
                        placeholder="Send a message"
                        placeholderTextColor={colors.placeholder}
                        multiline
                        textAlignVertical="center"
                    />
                    <TouchableOpacity disabled={(inputText.trim() || (getInputImageVideo.length > 0) || getInputAudio) ? false : true} onPress={() => sendMessage()} style={{ paddingHorizontal: 6, justifyContent: 'center' }}>
                        <MaterialCommunityIcons name="send" size={25} color={colors.accent} style={{ opacity: (inputText.trim() || (getInputImageVideo.length > 0) || getInputAudio) ? 1 : 0.4 }} />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>


        <BottomSheet ref={bottomSheet_convotools?.ref}
            index={-1} enablePanDownToClose
            snapPoints={bottomSheet_convotools?.snap}
            backdropComponent={ajjj} >
            <BottomSheetView>
                <SafeAreaView edges={['bottom']}>{funt.convoTools}</SafeAreaView>
            </BottomSheetView>
        </BottomSheet> 

        <ImageViewing
            images={[{ uri: getFullscreenClickImage }]}
            imageIndex={0}
            visible={!!getFullscreenClickImage}
            onRequestClose={() => { setFullscreenClickImage(null) }}
            swipeToCloseEnabled={true}
            doubleTapToZoomEnabled={true}
            presentationStyle="overFullScreen"
            animationType="fade"
        />

    </>
    );
};
