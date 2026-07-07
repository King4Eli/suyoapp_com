import React, { useState, useEffect, useRef, useLayoutEffect, useMemo, useCallback } from 'react';
import { View, Text, Pressable, TextInput, Alert, FlatList, Platform, TouchableOpacity, KeyboardAvoidingView, PermissionsAndroid, Linking, ImageBackground } from 'react-native';
import { Loaderx, bottomsheet_renderBackdrop } from '../funcs/functions_stateful';
import IonIcon from 'react-native-vector-icons/Ionicons';
import { namer, styles } from '../funcs/static';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { _http_request, help, llStorage, mediaHandler, screenWidth, hostServer, logReport, uploadHandler, navigationRef, cacheStorage } from '../funcs/functions';
import { Asset } from 'react-native-image-picker';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Sound, { AudioEncoderAndroidType, AudioSourceAndroidType, AVEncoderAudioQualityIOSType, OutputFormatAndroidType } from 'react-native-nitro-sound';
import RNFS from 'react-native-fs';
import Icon from 'react-native-vector-icons/Ionicons';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { Toastx } from '../funcs/customNotification';
import FastImage from 'react-native-fast-image';
import { SocketClient } from '../funcs/socket_realtimeData';
import ImageViewing from 'react-native-image-viewing';
import { useHeaderHeight } from '@react-navigation/elements';

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
interface convoInterface {
    messageId: string;
    fromMe: boolean;
    type: 'media' | 'text' | 'audio' | 'image' | 'video' | 'file';
    message: string | null;
    src: any[] | null;
    isUploading?: boolean;
}

export function Screen_conversation({ navigation, route }: { navigation: any, route: any }) {
    const ajjj=useCallback(bottomsheet_renderBackdrop,[]);

    const headerHeight = useHeaderHeight();
    const __MAPPER = llStorage.CONFIG.get()?.mapper;
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
                    <IonIcon name="sparkles-outline" size={20} color="#4F8EF7" />
                    <Text style={{ fontSize: 16, marginLeft: 10 }}>Plan a date idea</Text>
                </Pressable>
                <Pressable onPress={() => {
                    bottomSheet_convotools?.ref?.current?.close();
                    navigation.push(namer.navigation.peoplesOnePerson, { alreadyLiked: true, likedMatchedId: funt.matchId, getOnePersonId: getUser2Deets?.uid, });
                }} style={{ paddingHorizontal: 10, paddingVertical: 15, flexDirection: "row", alignItems: "center" }}>
                    <IonIcon name="person-outline" size={20} color="#4F8EF7" />
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
                            customApiUrl: hostServer() + "/api/core/v1/pushPeopleToMatch",
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
                    <IonIcon name="ban-outline" size={20} color="#4F8EF7" />
                    <Text style={{ fontSize: 16, marginLeft: 10 }}>Block User</Text>
                </Pressable>
                {/*<Pressable onPress={() => { bottomSheetRef_convotools.current?.close(); navigation.navigate("ReportUser", { userId: getUser2Deets?.u2id }); }}
                    style={{ paddingHorizontal: 10, paddingVertical: 15, flexDirection: "row", alignItems: "center" }}>
                    <IonIcon name="warning-outline" size={20} color="#4F8EF7" />
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
                customApiUrl: hostServer() + "/api/core/v1/getConversation",
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
            headerTitleAlign: 'left',
            headerTitle: () => <View style={{ alignItems: "center", flexDirection: "row", gap: 5 }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', textTransform: "capitalize" }}>{getUser2Deets?.fullname}</Text>
                {getUser2Deets?.verified ? <IonIcon name="checkmark-done-circle-sharp" size={20} color="#4F8EF7" /> : <></>}
            </View>,

            headerRight: () => <View style={{ paddingRight: 5, flexDirection: "row", alignItems: "center", gap: 18 }}>

                {/* Voice Call */}
                <Pressable
                    style={{ padding: 4 }}
                    onPress={() => {
                        Toastx.show({ message: "voice call coming soon", type: "success" });
                    }} >
                    <IonIcon name="call-outline" size={25} color="#4F8EF7" />
                </Pressable>

                {/* Video Call */}
                <Pressable
                    style={{ padding: 4 }}
                    onPress={() => {
                        Toastx.show({ message: "Video call coming soon", type: "success" });
                    }} >
                    <IonIcon name="videocam-outline" size={26} color="#4F8EF7" />
                </Pressable>

                {/* More Options */}
                <Pressable
                    style={{ padding: 4 }}
                    onPress={() => {
                        bottomSheet_convotools.ref.current?.expand();
                    }}
                >
                    <IonIcon name="ellipsis-horizontal" size={25} color="#4F8EF7" />
                </Pressable>

            </View>

        });
    }, [getUser2Deets]);



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
            const { name } = buildUploadTarget(file.fileName ?? `media_${index}`, mediaType);
            if (!file.uri) return;
            uploadDescriptors.push({
                uri: file.uri,
                name,
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
            const { name, } = buildUploadTarget(getInputAudio.split('/').pop() ?? `voice_note_${Date.now()}.m4a`, 'audio');
            uploadDescriptors.push({
                uri: getInputAudio,
                name,
                type: 'audio/m4a',
                mediaType: 'audio',
                meta: {
                    d: recordingMs,
                    size: null,
                    original: name,
                },
            });
        }

        // Prepare optimistic messages with local data
        let outgoingMessages: convoInterface[] = [];
        let messageIdsToUpdate: string[] = [];

        // Add media messages with local uris
        if (uploadDescriptors.length > 0) {
            // Group by media type
            const imagesVideos = uploadDescriptors.filter((d) => d.mediaType === 'img' || d.mediaType === 'video');
            const audios = uploadDescriptors.filter((d) => d.mediaType === 'audio');

            if (imagesVideos.length > 0) {
                const hasVideo = imagesVideos.some(d => d.mediaType === 'video');
                const messageId = help.randomAlphanumeric(29);
                messageIdsToUpdate.push(messageId);
                outgoingMessages.push({
                    messageId,
                    fromMe: true,
                    type: hasVideo ? "video" : "image",
                    message: null,
                    src: imagesVideos.map((d) => ({ p: d.uri, w: d.meta.w, h: d.meta.h, size: d.meta.size, d: d.meta.d, original: d.meta.original })),
                    isUploading: true
                });
            }

            if (audios.length > 0) {
                const messageId = help.randomAlphanumeric(29);
                messageIdsToUpdate.push(messageId);
                outgoingMessages.push({
                    messageId,
                    fromMe: true,
                    type: "audio",
                    message: null,
                    src: audios.map((d) => ({ p: d.uri, d: d.meta.d, size: d.meta.size, original: d.meta.original })),
                    isUploading: true
                });
            }
        }

        // Add text message if exists
        if (messageText.length > 0) {
            const messageId = help.randomAlphanumeric(29);
            outgoingMessages.push({
                messageId,
                fromMe: true,
                type: "text",
                message: messageText,
                src: null,
                isUploading: false
            });
        }

        // Clear input states
        setInputImageVideo([]);
        setInputText('');
        setInputAudio(null);
        setRecordingSamples([]);

        // Add optimistic messages to UI
        setConversations((prev) => [...outgoingMessages, ...prev]);

        setIsUploadingMedia(true);

        let uploadedMedia: UploadedMedia[] = [];
        try {
            for (const descriptor of uploadDescriptors) {
                const aa = await uploadWithPresigned(descriptor);
                uploadedMedia.push(aa);
            }
        } catch (error) {
            Toastx.show({ message: 'Unable to upload media. Please try again.', type: 'error' });
            logReport({
                type: "function -convo",
                useraction: "uploadWithPresigned",
                logMessage: "Unknown error during uploadWithPresigned",
                stackTrace: error
            });

            // Remove optimistic messages on upload error
            setConversations((prev) => prev.filter(msg => !messageIdsToUpdate.includes(msg.messageId)));
            setIsUploadingMedia(false);
            return;
        }

        // Update messages with uploaded src
        setConversations((prev) => prev.map(msg => {
            if (messageIdsToUpdate.includes(msg.messageId)) {
                // Find corresponding uploaded media
                const mediaType = msg.type === 'image' || msg.type === 'video' ? (msg.type === 'video' ? 'video' : 'img') : 'audio';
                const uploadedForType = uploadedMedia.filter(m => m.mediaType === mediaType);
                return {
                    ...msg,
                    src: uploadedForType.map(m => m.src),
                    isUploading: false
                };
            }
            return msg;
        }));

        // Prepare file_meta array for backend
        const file_meta: any[] = uploadedMedia.map((item) => ({
            url: item.src.p,
            path: item.src.p,
            w: item.src.w ?? null,
            h: item.src.h ?? null,
            size: item.src.size ?? null,
            d: item.src.d ?? null,
            original: item.src.original ?? null,
        }));

        const hasUploadedVideo = uploadedMedia.some((m) => m.mediaType === 'video');
        const realTimeData_updates = messageText.length > 0 ? messageText : (hasUploadedVideo ? ">>>video" : (uploadedMedia.some(m => m.mediaType === 'img') ? ">>>photo" : (uploadedMedia.some(m => m.mediaType === 'audio') ? ">>>audio" : "")));

        try {
            const response = await _http_request({
                customApiUrl: hostServer() + "/api/core/v1/pushConversation",
                reqType: 'POST',
                bodyArray: {
                    messagee: messageText,
                    match_id: funt.matchId,
                    file_meta: file_meta.length > 0 ? file_meta : undefined
                }
            });

            if (response?.code === 200) {
                const jy = getProfile?.profile?.fullname ?? "";
                if (getUser2Deets?.uid) {
                    SocketClient.emit("/pushUser/" + getUser2Deets?.uid, {
                        matchId: funt.matchId,
                        type: "single-convo",
                        payload:
                        {
                            firstName: (jy.split(" ")?.[0]) ?? jy,
                            lastMessage: realTimeData_updates,
                        }
                    });
                    const d = new Date();
                    const hours24 = d.getHours();
                    const hours12 = hours24 % 12 || 12;
                    const minutes = String(d.getMinutes()).padStart(2, "0");
                    const ampm = hours24 >= 12 ? "pm" : "am";
                }
            } else if (response !== null) {
                Alert.alert('Error!', response?.message ?? 'Unable to send message.');
                // Remove optimistic update on error
                setConversations((prev) => prev.filter(msg =>
                    !outgoingMessages.some(out => out.messageId === msg.messageId)
                ));
            } else {
                //setConvoSendingstatus(null);
            }
        } catch (error) {
            logReport({
                type: "function -convo",
                useraction: "sendMessage",
                logMessage: 'Send message error: ',
                stackTrace: error
            });
            // Remove optimistic update on error
            setConversations((prev) => prev.filter(msg =>
                !outgoingMessages.some(out => out.messageId === msg.messageId)
            ));
            Alert.alert('Error!', 'Failed to send message.');
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
        const audioMetaLabel = [audioDisplayLabel, fileSizeLabel].filter(Boolean).join(' | ');
        const fileOriginalName = firstSrc?.original;


        return (
            <View style={[styles.conversation_message_container, item.fromMe ? styles.conversation_currentUserMessage : styles.conversation_nextUserMessage]}>
                <View style={[styles.conversation_messageBubble, {
                    borderBottomRightRadius: (item.fromMe) ? 0 : 10,
                    borderBottomLeftRadius: (item.fromMe) ? 10 : 0,
                    backgroundColor: (isImage || isVideo) ? "#a1a1a111" : ((item.fromMe) ? '#E5E5EA' : '#0078fe')
                }]}>
                    {isText && <Text style={[styles.conversation_messageText, {
                        color: (item.fromMe) ? "#000" : "#fff"
                    }]}>{item?.message}</Text>}

                    {isVideo && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}>
                            <TouchableOpacity disabled={item.isUploading} onPress={() => {
                                const vidUri = resolveMediaUri(firstSrc);
                                if (vidUri) Linking.openURL(vidUri);
                            }} style={{ backgroundColor: item.fromMe ? '#fff' : '#1b5ec766', padding: 10, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
                                <MaterialCommunityIcons name="play-circle" size={22} color={item.fromMe ? "#000" : "#fff"} />
                                <Text style={{ color: item.fromMe ? "#000" : "#fff" }}>
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
                            }} style={{ backgroundColor: item.fromMe ? '#fff' : '#1b5ec766', padding: 10, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
                                <MaterialCommunityIcons name="file" size={20} color={item.fromMe ? "#000" : "#fff"} />
                                <Text style={{ color: item.fromMe ? "#000" : "#fff" }}>
                                    {fileOriginalName ?? 'File'}{fileSizeLabel ? ` | ${fileSizeLabel}` : ''}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {isAudio && (
                        <View style={{ paddingVertical: 5, maxWidth: '100%', minWidth: Math.min(screenWidth * 0.72, 320) }}>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
                                <TouchableOpacity disabled={item.isUploading} onPress={() => { handleAudioPress(item.messageId, audioUri) }}
                                    style={{ backgroundColor: item.fromMe ? '#fff' : '#1b5ec766', width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" }}>
                                    <IonIcon name={(isCurrentAudio && audioPlayback.isPlaying) ? "pause" : "play"} size={20} color={item.fromMe ? "#000" : "#fff"} />
                                </TouchableOpacity>
                                <View style={{ flex: 1, gap: 5 }}>
                                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                                        <Text style={{ color: (item.fromMe) ? "#000" : "#fff", fontWeight: "600" }}>
                                            {item.isUploading ? 'Uploading Voice note...' : 'Voice note'}
                                        </Text>
                                        {isCurrentAudio && audioPlayback.isPlaying && (
                                            <Text style={{ color: item.fromMe ? "#333" : "#dbe7ff", fontSize: 11 }}>playing</Text>
                                        )}
                                    </View>
                                    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 2, height: 20 }}>
                                        {audioWaveBars.map((bar) => (
                                            <View key={bar.key} style={{
                                                flex: 1,
                                                maxWidth: 4, // Limit maximum width
                                                width: 3,
                                                borderRadius: 3,
                                                height: bar.height,
                                                backgroundColor: bar.active
                                                    ? (item.fromMe ? '#0f172a' : '#e0f2fe')
                                                    : (item.fromMe ? '#94a3b8' : '#93c5fd99')
                                            }} />
                                        ))}
                                    </View>
                                    <View style={{
                                        height: 3,
                                        borderRadius: 3,
                                        backgroundColor: item.fromMe ? '#cbd5e1' : '#93c5fd66',
                                        overflow: 'hidden'
                                    }}>
                                        <View style={{
                                            height: '100%',
                                            width: `${Math.max(4, Math.round(audioProgressRatio * 100))}%`,
                                            backgroundColor: item.fromMe ? '#0f172a' : '#e0f2fe'
                                        }} />
                                    </View>
                                    <Text style={{ color: (item.fromMe) ? "#333" : "#dbe7ff", fontSize: 12 }}>
                                        {audioMetaLabel}
                                    </Text>
                                </View>
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
                                            <FastImage source={{ cache: FastImage.cacheControl.immutable, uri: imgPath }} style={{ width: targetWidth, height: targetHeight }} resizeMode="contain"
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
            </View>
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
        <SafeAreaView style={[styles.container, { paddingTop: headerHeight}]} edges={['bottom']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
                style={{ flex: 1 }} >

                <View style={{ paddingVertical: 5 }}>
                    <Pressable onPress={() => { navigation.push(namer.navigation.peoplesOnePerson, { alreadyLiked: true, likedMatchedId: funt.matchId, getOnePersonId: getUser2Deets?.uid }); }}
                        style={{ backgroundColor: '#f3f6ff', borderRadius: 14, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        {getUser2Deets?.image?.p ? <FastImage source={{ uri: imageDomain + getUser2Deets?.image?.p, cache: FastImage.cacheControl.immutable }}
                            style={{ width: 80, height: 80, borderRadius: 50 }} /> : <View style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: '#d7def5' }} />}
                        <View style={{ flex: 1, gap: 4 }}>
                            <Text style={{ fontSize: 16, fontWeight: 'bold', textTransform: "capitalize" }}>{getUser2Deets?.fullname || "Your match"}</Text>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                                {getUser2Deets?.city && <Text style={{ color: "#444" }}><IonIcon name="location-outline" size={14} color="#4F8EF7" /> {getUser2Deets?.city}</Text>}
                                {getUser2Deets?.verified && <View style={{ backgroundColor: "#e8f1ff", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, flexDirection: "row", alignItems: "center", gap: 4 }}>
                                    <IonIcon name="shield-checkmark" size={14} color="#4F8EF7" />
                                    <Text style={{ fontSize: 12, color: "#4F8EF7" }}>Verified</Text>
                                </View>}
                            </View>
                            <Text style={{ color: "#555", fontSize: 12 }}>Tap to view profile or read bio for conversation idea.</Text>
                        </View>
                        <IonIcon name="chevron-forward" size={20} color="#4F8EF7" />
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
                                        backgroundColor: idx === starterIndex ? '#0ea5e9' : '#e2e8f0'
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
                    <View style={{ marginHorizontal: 6, marginBottom: 8, padding: 12, borderRadius: 16, backgroundColor: isRecording ? '#fff1f1' : '#eef4ff', borderWidth: 1, borderColor: isRecording ? '#fbb4b4' : '#c9dcff', gap: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <View style={{ width: 42, height: 42, borderRadius: 30, backgroundColor: isRecording ? '#ffd6d6' : '#dfe8ff', alignItems: 'center', justifyContent: 'center' }}>
                                <MaterialCommunityIcons name={isRecording ? "record-circle" : "microphone-outline"} size={22} color={isRecording ? "#d00" : "#3b65ff"} />
                            </View>
                            <View style={{ flex: 1, gap: 2 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <Text style={{ fontWeight: '700', color: '#111827' }}>{isRecording ? "Recording voice note" : "Voice note ready"}</Text>
                                    {isRecording && <Text style={{ color: '#b91c1c', fontWeight: '700', fontSize: 11 }}>LIVE</Text>}
                                </View>
                                <Text style={{ color: '#334155', fontSize: 12 }}>{pendingTimeLabel} {isRecording ? "| max 3:00" : ""}</Text>
                            </View>
                        </View>

                        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 2, height: 22 }}>
                            {pendingWaveBars.map((bar) => (
                                <View key={bar.key} style={{
                                    width: 3,
                                    borderRadius: 3,
                                    height: bar.height,
                                    backgroundColor: bar.active ? '#2563eb' : '#94a3b8'
                                }} />
                            ))}
                        </View>
                        <View style={{ height: 3, borderRadius: 3, backgroundColor: '#bfdbfe', overflow: 'hidden' }}>
                            <View style={{ height: '100%', width: `${Math.max(4, Math.round(pendingProgressRatio * 100))}%`, backgroundColor: '#2563eb' }} />
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
                            {getInputAudio &&
                                <TouchableOpacity onPress={() => handleAudioPress('pending-audio', getInputAudio)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: '#dbeafe' }}>
                                    <MaterialCommunityIcons name={(audioPlayback.id === 'pending-audio' && audioPlayback.isPlaying) ? "pause-circle" : "play-circle"} size={22} color="#1d4ed8" />
                                </TouchableOpacity>
                            }

                            {!getInputAudio && <TouchableOpacity onPress={() => { stopVoiceNote(true) }} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: '#fee2e2' }}>
                                <MaterialCommunityIcons name="stop-circle" size={24} color={"#dc2626"} />
                            </TouchableOpacity>}

                            {isRecording && <TouchableOpacity onPress={() => { clearVoiceNote(); }} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f1f5f9' }}>
                                <Icon name="close" size={18} color="#334155" />
                            </TouchableOpacity>}

                            {getInputAudio &&
                                <TouchableOpacity onPress={clearVoiceNote} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f1f5f9' }}>
                                    <Icon name="trash-outline" size={18} color="#334155" />
                                </TouchableOpacity>
                            }
                        </View>
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
                        <MaterialCommunityIcons name="camera" size={25} color="#4F8EF7" />
                    </TouchableOpacity>
                    <TouchableOpacity disabled={voiceNoteLoading} onPress={() => toggleVoiceNote()} style={{ paddingHorizontal: 6, opacity: voiceNoteLoading ? 0.5 : 1 }}>
                        <MaterialCommunityIcons name={voiceNoteLoading ? "timer-sand" : (isRecording ? "stop-circle" : "microphone")} size={25} color={isRecording ? "#d00" : "#4F8EF7"} />
                    </TouchableOpacity>
                    <TextInput
                        ref={inputTextRef}
                        style={styles.conversation_textInput}
                        value={inputText}
                        onChangeText={setInputText}
                        placeholder="Send a message"
                        placeholderTextColor="#aaa"
                        multiline
                        textAlignVertical="center"
                    />
                    <TouchableOpacity disabled={(inputText.trim() || (getInputImageVideo.length > 0) || getInputAudio) ? false : true} onPress={() => sendMessage()} style={{ paddingHorizontal: 6, justifyContent: 'center' }}>
                        <MaterialCommunityIcons name="send" size={25} color="#4F8EF7" style={{ opacity: (inputText.trim() || (getInputImageVideo.length > 0) || getInputAudio) ? 1 : 0.4 }} />
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
