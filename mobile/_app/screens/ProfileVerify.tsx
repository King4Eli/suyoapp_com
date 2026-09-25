import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Image,
  ActivityIndicator,
} from 'react-native';
import { launchCamera } from 'react-native-image-picker';
import RNFS from 'react-native-fs';
import IIcon from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { _http_request, cacheStorage, uploadHandler } from '../funcs/functions';
import { Loaderx } from '../funcs/functions_stateful';
import { Dialogx } from '../funcs/customDialog';
import { __CONFIG__ } from '../funcs/static';
import { useTheme, ThemeColors } from '../funcs/theme';

type VerificationState = {
  status: 'verified' | 'pending' | 'rejected' | 'none';
  rejectReason?: string | null;
  submittedAt?: string | null;
  pose?: { code: string; label: string; icon: string };
};

// Selfie verification (api global/verification.js): copy the pose the server
// picked, take a front-camera selfie, and it goes to the admin review queue.
export function Screen_profileVerify({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const [state, setState] = useState<VerificationState | null>(null);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res: any = await _http_request({
      customApiUrl:
        __CONFIG__.HTTPS_API_DOMAIN + '/api/core/v1/getVerification',
      reqType: 'POST',
    });
    if (res?.code === 200) setState(res);
    else
      Dialogx.alert(
        "Couldn't load verification",
        res?.message ?? 'Please try again.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
        { tone: 'error' },
      );
  }, [navigation]);

  useEffect(() => {
    navigation.setOptions({
      title: 'Verify your profile',
      headerStyle: { backgroundColor: colors.background },
      headerShadowVisible: false,
    });
    load();
  }, [navigation, colors.background, load]);

  const takeSelfie = async () => {
    const result = await launchCamera({
      mediaType: 'photo',
      cameraType: 'front',
      quality: 0.8,
      maxWidth: 1280,
      maxHeight: 1280,
      saveToPhotos: false,
    });
    if (result.errorCode === 'camera_unavailable') {
      Dialogx.alert(
        'No camera available',
        'Verification needs a selfie taken with your phone camera.',
        undefined,
        { tone: 'error', icon: 'camera' },
      );
      return;
    }
    if (result.errorCode === 'permission') {
      Dialogx.alert(
        'Camera access needed',
        'Allow camera access in your phone settings to take your verification selfie.',
        undefined,
        { tone: 'warning', icon: 'camera' },
      );
      return;
    }
    const uri = result.assets?.[0]?.uri;
    if (uri) setSelfieUri(uri);
  };

  const submit = async () => {
    if (!selfieUri || !state?.pose) return;
    Loaderx.show();
    try {
      const ext = (selfieUri.split('.').pop() || 'jpg').toLowerCase();
      const presigned = await uploadHandler.requestPresignedURL_Upload(
        ext,
        'profile-verify',
      );
      const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
      const upload = await RNFS.uploadFiles({
        toUrl: presigned.uploadUrl,
        files: [
          {
            name: 'file',
            filename: `verify_${Date.now()}.${ext}`,
            filepath: selfieUri.replace('file://', ''),
            filetype: contentType,
          },
        ],
        method: presigned.method || 'PUT',
        headers: uploadHandler.uploadHeaders(presigned, contentType),
        binaryStreamOnly: true,
      }).promise;
      if (upload.statusCode < 200 || upload.statusCode >= 300) {
        throw new Error("Your selfie didn't upload. Please try again.");
      }

      const res: any = await _http_request({
        customApiUrl:
          __CONFIG__.HTTPS_API_DOMAIN + '/api/core/v1/pushVerification',
        reqType: 'POST',
        bodyArray: {
          selfiePath: uploadHandler.resolveObjectPath(presigned),
          pose: state.pose.code,
        },
      });
      if (res?.code !== 200) {
        if (res?.reason === 'pose_expired') {
          setSelfieUri(null);
          await load();
        }
        throw new Error(res?.message ?? 'Please try again.');
      }
      setSelfieUri(null);
      await cacheStorage.getCurrentUserProfile(true).catch(() => {});
      setState({ status: 'pending', submittedAt: new Date().toISOString() });
      Dialogx.alert('Selfie submitted', res?.message, [{ text: 'Done' }], {
        tone: 'success',
        icon: 'shield-checkmark',
      });
    } catch (err: any) {
      Dialogx.alert(
        "Couldn't submit your selfie",
        err?.message ?? 'Please try again.',
        undefined,
        { tone: 'error' },
      );
    } finally {
      Loaderx.hide();
    }
  };

  if (!state) {
    return (
      <View style={[s.root, s.center]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // ── Verified / under review ──────────────────────────────────────────────
  if (state.status === 'verified' || state.status === 'pending') {
    const verified = state.status === 'verified';
    return (
      <SafeAreaView style={[s.root, s.center]} edges={['bottom']}>
        <View
          style={[
            s.statusIcon,
            {
              backgroundColor:
                (verified ? colors.success : colors.warning) + '22',
            },
          ]}
        >
          <IIcon
            name={verified ? 'shield-checkmark' : 'time'}
            size={44}
            color={verified ? colors.success : colors.warning}
          />
        </View>
        <Text style={s.title}>
          {verified ? "You're verified" : 'Selfie under review'}
        </Text>
        <Text style={s.body}>
          {verified
            ? 'Your profile shows the verified badge, so people know you are who your photos say.'
            : "We're checking your selfie against your profile photos -- usually within a day. You'll see the badge on your profile once it's approved."}
        </Text>
        <Pressable style={s.primaryButton} onPress={() => navigation.goBack()}>
          <Text style={s.primaryButtonText}>Done</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // ── Take / retake the selfie ─────────────────────────────────────────────
  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.content}>
        {state.status === 'rejected' && (
          <View style={s.rejectBox}>
            <IIcon name="alert-circle" size={18} color={colors.danger} />
            <Text style={s.rejectText}>
              Your last selfie wasn't approved
              {state.rejectReason ? `: ${state.rejectReason}` : '.'} Please try
              again with the new pose below.
            </Text>
          </View>
        )}

        <Text style={s.title}>Get the verified badge</Text>
        <Text style={s.body}>
          Take a selfie copying the pose below. Our team compares it with your
          profile photos -- it's never shown on your profile.
        </Text>

        {state.pose && (
          <View style={s.poseCard}>
            <View style={s.poseIcon}>
              <IIcon name={state.pose.icon} size={34} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.poseEyebrow}>YOUR POSE</Text>
              <Text style={s.poseLabel}>{state.pose.label}</Text>
            </View>
          </View>
        )}

        {selfieUri ? (
          <Image source={{ uri: selfieUri }} style={s.preview} />
        ) : (
          <View style={s.tips}>
            {[
              'Face the camera in good light',
              'Only you in the photo, no filters',
              'Copy the pose exactly',
            ].map(tip => (
              <View key={tip} style={s.tipRow}>
                <IIcon
                  name="checkmark-circle"
                  size={18}
                  color={colors.success}
                />
                <Text style={s.tipText}>{tip}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={s.footer}>
        {selfieUri ? (
          <>
            <Pressable style={s.secondaryButton} onPress={takeSelfie}>
              <Text style={s.secondaryButtonText}>Retake</Text>
            </Pressable>
            <Pressable style={[s.primaryButton, { flex: 1 }]} onPress={submit}>
              <Text style={s.primaryButtonText}>Submit selfie</Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            style={[s.primaryButton, { flex: 1 }]}
            onPress={takeSelfie}
          >
            <IIcon name="camera" size={18} color={colors.onPrimary} />
            <Text style={s.primaryButtonText}>Take selfie</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
    content: { padding: 20, gap: 14 },
    statusIcon: {
      width: 88,
      height: 88,
      borderRadius: 44,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    title: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'center',
      letterSpacing: -0.3,
    },
    body: {
      fontSize: 14.5,
      lineHeight: 21,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 6,
      marginBottom: 8,
    },
    rejectBox: {
      flexDirection: 'row',
      gap: 8,
      padding: 12,
      borderRadius: 14,
      backgroundColor: colors.danger + '14',
    },
    rejectText: { flex: 1, fontSize: 13.5, lineHeight: 19, color: colors.text },
    poseCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 16,
      borderRadius: 20,
      backgroundColor: colors.primarySoft,
    },
    poseIcon: {
      width: 60,
      height: 60,
      borderRadius: 30,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    poseEyebrow: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.8,
      color: colors.primary,
    },
    poseLabel: {
      fontSize: 16.5,
      fontWeight: '700',
      color: colors.text,
      marginTop: 3,
    },
    tips: { gap: 10, marginTop: 6 },
    tipRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    tipText: { fontSize: 14.5, color: colors.text },
    preview: {
      width: '100%',
      aspectRatio: 3 / 4,
      borderRadius: 20,
      backgroundColor: colors.backgroundSecondary,
    },
    footer: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 12,
    },
    primaryButton: {
      height: 52,
      borderRadius: 26,
      paddingHorizontal: 24,
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      marginTop: 8,
    },
    primaryButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.onPrimary,
    },
    secondaryButton: {
      height: 52,
      borderRadius: 26,
      paddingHorizontal: 24,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: 8,
    },
    secondaryButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
  });
}
