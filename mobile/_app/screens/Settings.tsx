import React, {
  useState,
  useRef,
  useMemo,
  useEffect,
  useLayoutEffect,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Linking,
  Share,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Dialogx } from '../funcs/customDialog';
import { getApiBuild } from '../funcs/functions/apiBuild';
import { sessionManager } from '../funcs/SessionContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { namer, styles, __CONFIG__ } from '../funcs/static';
import {
  __init__app,
  _http_request,
  cacheStorage,
  help,
  logReport,
} from '../funcs/functions';
import DeviceInfo from 'react-native-device-info';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import IIcon from 'react-native-vector-icons/Ionicons';
import Feather from 'react-native-vector-icons/Feather';
import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetTextInput,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { Toastx } from '../funcs/customNotification';
import { onPaymentRefreshed } from '../funcs/functions/paymentNotices';
import { CarouselRef, ControlledCarousel } from '../funcs/customCarousel';
import {
  bottomsheet_renderBackdrop,
  bottomsheet_renderHandle,
} from '../funcs/functions_stateful';
import { useTheme, ThemeMode, ThemeColors } from '../funcs/theme';
import {
  SubscriptionCard,
  confirmCancelPlan,
  describePlan,
} from '../funcs/customSubscriptionCard';

export function Screen_settings({ navigation }: { navigation: any }) {
  const [getProfile, setProfile] = useState<any>(null);
  const { colors, mode, setMode } = useTheme();
  const MODERN_COLORS = colors;
  const modernStyles = useMemo(() => createModernStyles(colors), [colors]);

  const [privacyShowDistance, setPrivacyShowDistance] = useState(true);
  const [privacyShowAge, setPrivacyShowAge] = useState(true);
  const [privacyIncognitoMode, setPrivacyIncognitoMode] = useState(false);
  const [privacyReadReceipts, setPrivacyReadReceipts] = useState(false);
  const [notifyPushEnabled, setNotifyPushEnabled] = useState(true);
  const [notifyEmailEnabled, setNotifyEmailEnabled] = useState(true);

  const subscriptionState = help.getSubscriptionState(getProfile);
  const currentPlan = describePlan(getProfile);
  // Which API build answered last (X-Api-Build), shown under the app version.
  const [apiBuild, setApiBuild] = useState<string | null>(null);
  useEffect(() => {
    getApiBuild().then(setApiBuild);
  }, []);
  const profileDetails = getProfile?.profile ?? {};
  const profileEmail = profileDetails?.email ?? getProfile?.user_email ?? '';
  const hasRealEmail = !!profileEmail;
  const profilePhone =
    profileDetails?.phonenumber ?? getProfile?.user_phonenumber ?? '';

  const safeInsets = useSafeAreaInsets();

  // Push/privacy sheets size to their content; email/phone hold a carousel that
  // needs a fixed height (its pages scroll when the content doesn't fit)
  const bottomSheetRef_push = { ref: useRef<BottomSheet>(null) };
  const bottomSheetRef_email = {
    ref: useRef<BottomSheet>(null),
    snap: useMemo(() => ['60%', '80%'], []),
  };
  const bottomSheetRef_phone = {
    ref: useRef<BottomSheet>(null),
    snap: useMemo(() => ['60%', '80%'], []),
  };
  const bottomSheetRef_privacy = { ref: useRef<BottomSheet>(null) };

  const privacyDefaults = {
    showDistance: true,
    showAge: true,
    incognitoMode: false,
    readReceipts: false,
  };
  const notificationDefaults = {
    pushEnabled: true,
    emailEnabled: true,
  };

  // Plan changes (checkout, renewal, cancel) refresh the cached profile elsewhere;
  // pick them up whenever Settings comes back into view.
  useEffect(() => {
    const reload = () => {
      cacheStorage
        .getCurrentUserProfile()
        .then((profile: any) => profile && setProfile(profile))
        .catch(() => {});
    };
    const unsubscribeFocus = navigation.addListener('focus', reload);
    // a payment can also land while Settings is already open (webhook/socket)
    const unsubscribePayment = onPaymentRefreshed(reload);
    return () => {
      unsubscribeFocus();
      unsubscribePayment();
    };
  }, [navigation]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const profile = await cacheStorage.getCurrentUserProfile();
        if (!mounted) return;
        setProfile(profile);
        const privacy = profile?.profile?.privacy;
        setPrivacyShowDistance(
          privacy?.showDistance ?? privacyDefaults.showDistance,
        );
        setPrivacyShowAge(privacy?.showAge ?? privacyDefaults.showAge);
        setPrivacyIncognitoMode(
          privacy?.incognitoMode ?? privacyDefaults.incognitoMode,
        );
        setPrivacyReadReceipts(
          privacy?.readReceipts ?? privacyDefaults.readReceipts,
        );
        const notifications = profile?.profile?.notifications;
        setNotifyPushEnabled(
          notifications?.push ?? notificationDefaults.pushEnabled,
        );
        setNotifyEmailEnabled(
          notifications?.email ?? notificationDefaults.emailEnabled,
        );
      } catch {
        if (mounted) setProfile(null);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [
    privacyDefaults.incognitoMode,
    privacyDefaults.readReceipts,
    privacyDefaults.showAge,
    privacyDefaults.showDistance,
    notificationDefaults.emailEnabled,
    notificationDefaults.pushEnabled,
  ]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerStyle: { backgroundColor: colors.background },
      headerShadowVisible: false,
      headerTitle: '',
    });
  }, [navigation, colors.background]);

  // Stored on the account (users.user_notify_*) -- the server decides which
  // emails to send from these.
  const pushNotificationSettings = async (push: boolean, email: boolean) => {
    const response = await _http_request({
      customApiUrl: __CONFIG__.HTTPS_API_DOMAIN + '/api/core/v1/pushProfile',
      reqType: 'POST',
      bodyArray: { prof_notifications: { push, email } },
    });
    if (response?.code !== 200) {
      throw new Error(
        response?.message ?? 'Failed to save notification settings',
      );
    }
    cacheStorage.getCurrentUserProfile(true);
  };

  const saveNotificationSettings = async () => {
    try {
      await pushNotificationSettings(notifyPushEnabled, notifyEmailEnabled);
      Toastx.show({ type: 'success', message: 'Notification settings saved' });
      bottomSheetRef_push.ref.current?.close();
    } catch {
      Toastx.show({
        type: 'error',
        message: 'Failed to save notification settings',
      });
      logReport({
        type: 'function',
        useraction: 'saveNotificationSettings',
        logMessage: 'Failed to save notification settings',
      });
    }
  };

  const resetNotificationSettings = async () => {
    setNotifyPushEnabled(notificationDefaults.pushEnabled);
    setNotifyEmailEnabled(notificationDefaults.emailEnabled);
    try {
      await pushNotificationSettings(
        notificationDefaults.pushEnabled,
        notificationDefaults.emailEnabled,
      );
      Toastx.show({ type: 'success', message: 'Notification settings reset' });
    } catch {
      Toastx.show({
        type: 'error',
        message: 'Failed to reset notification settings',
      });
      logReport({
        type: 'function',
        useraction: 'resetNotificationSettings',
        logMessage: 'Failed to reset notification settings',
      });
    }
  };

  const savePrivacySettings = async () => {
    try {
      const response = await _http_request({
        customApiUrl: __CONFIG__.HTTPS_API_DOMAIN + '/api/core/v1/pushProfile',
        reqType: 'POST',
        bodyArray: {
          prof_privacy: {
            showDistance: privacyShowDistance,
            showAge: privacyShowAge,
            incognitoMode: privacyIncognitoMode,
            readReceipts: privacyReadReceipts,
          },
        },
      });
      if (response?.code !== 200) {
        throw new Error(response?.message ?? 'Failed to save privacy settings');
      }
      cacheStorage.getCurrentUserProfile(true);
      Toastx.show({ type: 'success', message: 'Privacy settings saved' });
      bottomSheetRef_privacy.ref.current?.close();
    } catch {
      Toastx.show({
        type: 'error',
        message: 'Failed to save privacy settings',
      });
      logReport({
        type: 'function',
        useraction: 'savePrivacySettings',
        logMessage: 'Failed to save privacy settings',
      });
    }
  };

  const resetPrivacySettings = async () => {
    setPrivacyShowDistance(privacyDefaults.showDistance);
    setPrivacyShowAge(privacyDefaults.showAge);
    setPrivacyIncognitoMode(privacyDefaults.incognitoMode);
    setPrivacyReadReceipts(privacyDefaults.readReceipts);
    try {
      const response = await _http_request({
        customApiUrl: __CONFIG__.HTTPS_API_DOMAIN + '/api/core/v1/pushProfile',
        reqType: 'POST',
        bodyArray: { prof_privacy: privacyDefaults },
      });
      if (response?.code !== 200) {
        throw new Error(
          response?.message ?? 'Failed to reset privacy settings',
        );
      }
      cacheStorage.getCurrentUserProfile(true);
      Toastx.show({ type: 'success', message: 'Privacy settings reset' });
    } catch {
      Toastx.show({
        type: 'error',
        message: 'Failed to reset privacy settings',
      });
      logReport({
        type: 'function',
        useraction: 'resetPrivacySettings',
        logMessage: 'Failed to reset privacy settings',
      });
    }
  };

  // Modern card component
  const ModernCard = ({ children, style }: any) => (
    <View style={[modernStyles.card, style]}>{children}</View>
  );

  // Modern option item
  const ModernOption = ({
    icon,
    title,
    subtitle,
    onPress,
    rightElement,
    danger = false,
    premium = false,
    hr = true,
  }: any) => (
    <TouchableOpacity
      style={[
        modernStyles.optionItem,
        hr && { borderBottomWidth: 1, borderBottomColor: MODERN_COLORS.border },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={modernStyles.optionLeft}>
        <View
          style={[
            modernStyles.optionIcon,
            danger && modernStyles.optionIconDanger,
            premium && modernStyles.optionIconPremium,
          ]}
        >
          <IIcon
            name={icon}
            size={20}
            color={
              danger
                ? MODERN_COLORS.error
                : premium
                ? MODERN_COLORS.premium
                : MODERN_COLORS.primary
            }
          />
        </View>
        <View style={modernStyles.optionContent}>
          <Text
            style={[
              modernStyles.optionTitle,
              danger && modernStyles.optionTitleDanger,
            ]}
          >
            {title}
          </Text>
          {subtitle && (
            <Text style={modernStyles.optionSubtitle}>{subtitle}</Text>
          )}
        </View>
      </View>
      {rightElement || (
        <IIcon
          name="chevron-forward"
          size={20}
          color={MODERN_COLORS.textTertiary}
        />
      )}
    </TouchableOpacity>
  );

  // Modern switch item
  const ModernSwitch = ({
    icon,
    title,
    subtitle,
    value,
    onValueChange,
    premiumLock = false,
    hr = true,
  }: any) => (
    <View
      style={[
        modernStyles.switchItem,
        hr && { borderBottomWidth: 1, borderBottomColor: MODERN_COLORS.border },
      ]}
    >
      <View style={modernStyles.switchLeft}>
        <View style={modernStyles.switchIcon}>
          <IIcon name={icon} size={20} color={MODERN_COLORS.primary} />
        </View>
        <View style={modernStyles.switchContent}>
          <Text style={modernStyles.switchTitle}>{title}</Text>
          {subtitle && (
            <Text style={modernStyles.switchSubtitle}>{subtitle}</Text>
          )}
        </View>
      </View>
      <TouchableOpacity
        onPress={() => {
          if (premiumLock && !subscriptionState.features.readReceipts) {
            Dialogx.alert(
              'This is a Plus perk',
              `Upgrade to Plus or VIP to turn on ${
                title?.toLowerCase?.() ?? 'this feature'
              }.`,
              [
                { text: 'Not now', style: 'cancel' },
                {
                  text: 'See Plus',
                  onPress: () =>
                    navigation.navigate(namer.navigation.subscription, {
                      tab: 'plus',
                    }),
                },
              ],
              { tone: 'info', icon: 'star' },
            );
          } else {
            onValueChange(!value);
          }
        }}
        activeOpacity={0.7}
      >
        <View
          style={[
            modernStyles.switchTrack,
            value && modernStyles.switchTrackActive,
            premiumLock &&
              !subscriptionState.features.readReceipts &&
              modernStyles.switchTrackDisabled,
          ]}
        >
          <View
            style={[
              modernStyles.switchThumb,
              value && modernStyles.switchThumbActive,
            ]}
          />
        </View>
      </TouchableOpacity>
    </View>
  );

  // Modern section header
  const ModernSection = ({ title, icon, children }: any) => (
    <View style={modernStyles.section}>
      <View style={modernStyles.sectionHeader}>
        <View style={modernStyles.sectionIcon}>
          <IIcon name={icon} size={18} color={MODERN_COLORS.primary} />
        </View>
        <Text style={modernStyles.sectionTitle}>{title}</Text>
      </View>
      <ModernCard>{children}</ModernCard>
    </View>
  );

  // Quick actions bar
  const QuickActions = () => (
    <View style={modernStyles.quickActions}>
      <TouchableOpacity
        style={modernStyles.quickAction}
        onPress={() => Linking.openURL(`mailto:${__CONFIG__.SUPPORT_EMAIL}`)}
      >
        <Feather name="help-circle" size={20} color="#FFF" />
        <Text style={modernStyles.quickActionText}>Support</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={modernStyles.quickAction}
        onPress={async () => {
          await Share.share({
            title: `Join me on ${__CONFIG__.BRAND_NAME}`,
            message: `I'm using ${__CONFIG__.BRAND_NAME} to meet amazing people. Join me!`,
          });
        }}
      >
        <Feather name="share-2" size={20} color="#FFF" />
        <Text style={modernStyles.quickActionText}>Share</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={modernStyles.quickAction}
        onPress={() => navigation.navigate(namer.navigation.subscription)}
      >
        <Feather name="crown" size={20} color="#FFF" />
        <Text style={modernStyles.quickActionText}>Plus & VIP</Text>
      </TouchableOpacity>
    </View>
  );

  // Appearance: Light / Dark / System switch
  const AppearanceSwitcher = () => {
    const options: { key: ThemeMode; label: string; icon: string }[] = [
      { key: 'light', label: 'Light', icon: 'sunny-outline' },
      { key: 'dark', label: 'Dark', icon: 'moon-outline' },
      { key: 'system', label: 'System', icon: 'phone-portrait-outline' },
    ];
    return (
      <View style={modernStyles.appearanceRow}>
        {options.map(opt => {
          const active = mode === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              onPress={() => setMode(opt.key)}
              activeOpacity={0.8}
              style={[
                modernStyles.appearanceOption,
                active && modernStyles.appearanceOptionActive,
              ]}
            >
              <IIcon
                name={opt.icon}
                size={20}
                color={active ? colors.onPrimary : colors.textSecondary}
              />
              <Text
                style={[
                  modernStyles.appearanceOptionText,
                  active && modernStyles.appearanceOptionTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  // Email Change Flow Component - FIXED KeyboardAvoidingView position
  const EmailChangeFlow = ({
    currentEmail,
    onComplete,
    onCancel,
  }: {
    currentEmail: string;
    onComplete: () => void;
    onCancel: () => void;
  }) => {
    const [step, setStep] = useState(0);
    const [newEmail, setNewEmail] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const carouselRef = useRef<CarouselRef>(null);

    const steps = [
      {
        title: 'Change Email',
        subtitle: 'Enter your new email address',
        content: (
          <View style={{}}>
            <View style={modernStyles.currentInfo}>
              <Text style={modernStyles.currentLabel}>Current Email</Text>
              <Text style={modernStyles.currentValue}>
                {currentEmail || 'None yet'}
              </Text>
            </View>

            <View style={modernStyles.inputGroup}>
              <Text style={modernStyles.inputLabel}>New Email Address</Text>
              <BottomSheetTextInput
                style={modernStyles.input}
                placeholder="your@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={newEmail}
                onChangeText={text => {
                  setNewEmail(text);
                  setError('');
                }}
                editable={!isLoading}
              />
            </View>

            {error ? <Text style={modernStyles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[
                modernStyles.primaryButton,
                (!newEmail || isLoading) && modernStyles.buttonDisabled,
              ]}
              onPress={async () => {
                const trimmedEmail = newEmail.trim().toLowerCase();
                const trimmedCurrentEmail = currentEmail.trim().toLowerCase();
                if (!trimmedEmail || trimmedEmail === trimmedCurrentEmail) {
                  setError('Please enter a different email address');
                  return;
                }

                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(trimmedEmail)) {
                  setError('Please enter a valid email address');
                  return;
                }

                setIsLoading(true);
                setError('');

                try {
                  const response = await _http_request({
                    customApiUrl:
                      __CONFIG__.HTTPS_API_DOMAIN + '/api/core/v1/pushNewEmail',
                    reqType: 'POST',
                    bodyArray: {
                      oldemail: trimmedCurrentEmail,
                      newemail: trimmedEmail,
                      rnc: '1',
                    },
                  });

                  if (response?.code === 200) {
                    setNewEmail(trimmedEmail);
                    setSuccessMessage(
                      'Verification code sent to your new email',
                    );
                    carouselRef.current?.goToNext();
                  } else {
                    setError(
                      response?.message || 'Failed to send verification',
                    );
                  }
                } catch {
                  setError('Network error. Please try again.');
                  logReport({
                    type: 'function',
                    useraction: 'pushNewEmail',
                    logMessage: 'Network error during email change',
                  });
                } finally {
                  setIsLoading(false);
                }
              }}
              disabled={!newEmail || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={modernStyles.primaryButtonText}>
                  Send Verification Code
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={modernStyles.secondaryButton}
              onPress={onCancel}
            >
              <Text style={modernStyles.secondaryButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ),
      },
      {
        title: 'Verify Email',
        subtitle: 'Enter the 6-digit code sent to your new email',
        content: (
          <View style={{}}>
            <View style={modernStyles.infoBox}>
              <IIcon
                name="mail-outline"
                size={24}
                color={MODERN_COLORS.primary}
              />
              <Text style={modernStyles.infoText}>
                Code sent to:{' '}
                <Text style={{ fontWeight: 'bold' }}>{newEmail}</Text>
              </Text>
            </View>

            <View style={modernStyles.inputGroup}>
              <Text style={modernStyles.inputLabel}>Verification Code</Text>
              <BottomSheetTextInput
                style={modernStyles.input}
                placeholder="Enter 6-digit code"
                keyboardType="number-pad"
                maxLength={6}
                value={verificationCode}
                onChangeText={text => {
                  setVerificationCode(text.replace(/[^0-9]/g, ''));
                  setError('');
                }}
                editable={!isLoading}
              />
            </View>

            <TouchableOpacity
              style={modernStyles.resendButton}
              onPress={async () => {
                setIsLoading(true);
                try {
                  const response = await _http_request({
                    customApiUrl:
                      __CONFIG__.HTTPS_API_DOMAIN + '/api/core/v1/pushNewEmail',
                    reqType: 'POST',
                    bodyArray: {
                      oldemail: currentEmail.trim().toLowerCase(),
                      newemail: newEmail.trim().toLowerCase(),
                      rnc: '1',
                    },
                  });

                  if (response?.code === 200) {
                    Toastx.show({
                      type: 'success',
                      message: response.message ?? 'New code sent!',
                    });
                  } else {
                    Toastx.show({
                      type: 'error',
                      message: response?.message ?? 'Failed to resend code',
                    });
                  }
                } catch {
                  Toastx.show({
                    type: 'error',
                    message: 'Failed to resend code',
                  });
                  logReport({
                    type: 'function',
                    useraction: 'resendEmailVerificationCode',
                    logMessage: 'Failed to resend email verification code',
                  });
                } finally {
                  setIsLoading(false);
                }
              }}
              disabled={isLoading}
            >
              <Text style={modernStyles.resendButtonText}>Resend Code</Text>
            </TouchableOpacity>

            {error ? <Text style={modernStyles.errorText}>{error}</Text> : null}
            {successMessage ? (
              <Text style={modernStyles.successText}>{successMessage}</Text>
            ) : null}

            <View style={modernStyles.buttonRow}>
              <TouchableOpacity
                style={[modernStyles.secondaryButton, { flex: 1 }]}
                onPress={() => carouselRef.current?.goToPrevious()}
              >
                <Text style={modernStyles.secondaryButtonText}>Back</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  modernStyles.primaryButton,
                  { flex: 1 },
                  (verificationCode.length !== 6 || isLoading) &&
                    modernStyles.buttonDisabled,
                ]}
                onPress={async () => {
                  if (verificationCode.length !== 6) {
                    setError('Please enter a valid 6-digit code');
                    return;
                  }

                  setIsLoading(true);
                  try {
                    const response = await _http_request({
                      customApiUrl:
                        __CONFIG__.HTTPS_API_DOMAIN +
                        '/api/core/v1/pushNewEmail',
                      reqType: 'POST',
                      bodyArray: {
                        oldemail: currentEmail.trim().toLowerCase(),
                        newemail: newEmail.trim().toLowerCase(),
                        vcode: verificationCode,
                      },
                    });

                    if (response?.code === 200) {
                      Dialogx.alert(
                        'Email updated',
                        'Receipts and account emails will go to your new address from now on.',
                        undefined,
                        { tone: 'success', icon: 'mail' },
                      );
                      onComplete();
                    } else {
                      setError(
                        response?.message || 'Invalid verification code',
                      );
                    }
                  } catch {
                    setError('Network error. Please try again.');
                    logReport({
                      type: 'function',
                      useraction: 'updateEmail',
                      logMessage: 'Network error during email update',
                    });
                  } finally {
                    setIsLoading(false);
                  }
                }}
                disabled={verificationCode.length !== 6 || isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={modernStyles.primaryButtonText}>
                    Verify & Update
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ),
      },
    ];

    // Keyboard is handled by the sheet (keyboardBehavior + BottomSheetTextInput)
    return (
      <View style={{ flex: 1 }}>
        <ControlledCarousel
          ref={carouselRef}
          initialPage={0}
          onPageChange={setStep}
          pages={steps.map((stepConfig, index) => (
            <BottomSheetScrollView
              key={index}
              style={{ flex: 1 }}
              contentContainerStyle={{
                paddingHorizontal: 20,
                paddingBottom: 20,
              }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={modernStyles.flowHeader}>
                <Text style={modernStyles.flowTitle}>{stepConfig.title}</Text>
                <Text style={modernStyles.flowSubtitle}>
                  {stepConfig.subtitle}
                </Text>
              </View>
              {stepConfig.content}
            </BottomSheetScrollView>
          ))}
        />

        <View style={modernStyles.stepIndicator}>
          {steps.map((_, index) => (
            <View
              key={index}
              style={[
                modernStyles.stepDot,
                index === step && modernStyles.stepDotActive,
              ]}
            />
          ))}
        </View>
      </View>
    );
  };

  // Phone Change Flow Component - FIXED KeyboardAvoidingView position
  const PhoneChangeFlow = ({
    currentPhone,
    onComplete,
    onCancel,
  }: {
    currentPhone: string;
    onComplete: () => void;
    onCancel: () => void;
  }) => {
    const [step, setStep] = useState(0);
    const [newPhone, setNewPhone] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const carouselRef = useRef<CarouselRef>(null);

    const steps = [
      {
        title: 'Change Phone',
        subtitle: 'Enter your new phone number',
        content: (
          <View style={{}}>
            <View style={modernStyles.currentInfo}>
              <Text style={modernStyles.currentLabel}>Current Phone</Text>
              <Text style={modernStyles.currentValue}>{currentPhone}</Text>
            </View>

            <View style={modernStyles.inputGroup}>
              <Text style={modernStyles.inputLabel}>New Phone Number</Text>
              <BottomSheetTextInput
                style={modernStyles.input}
                placeholder="+1 555 000 0000"
                keyboardType="phone-pad"
                autoCapitalize="none"
                value={newPhone}
                onChangeText={text => {
                  setNewPhone(text.replace(/[^0-9]/g, ''));
                  setError('');
                }}
                editable={!isLoading}
              />
            </View>

            {error ? <Text style={modernStyles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[
                modernStyles.primaryButton,
                (!newPhone || isLoading) && modernStyles.buttonDisabled,
              ]}
              onPress={async () => {
                const trimmedPhone = newPhone.replace(/[^0-9]/g, '');
                const currentPhoneDigits = currentPhone.replace(/[^0-9]/g, '');
                if (!trimmedPhone || trimmedPhone === currentPhoneDigits) {
                  setError('Please enter a different phone number');
                  return;
                }
                if (trimmedPhone.length < 7) {
                  setError('Please enter a valid phone number');
                  return;
                }

                setIsLoading(true);
                setError('');

                try {
                  const response = await _http_request({
                    customApiUrl:
                      __CONFIG__.HTTPS_API_DOMAIN +
                      '/api/core/v1/pushNewPhonenumber',
                    reqType: 'POST',
                    bodyArray: {
                      oldpnumber: currentPhoneDigits,
                      newpnumber: trimmedPhone,
                      rnc: '1',
                    },
                  });

                  if (response?.code === 200) {
                    setSuccessMessage(
                      'Verification code sent to your new phone',
                    );
                    carouselRef.current?.goToNext();
                  } else {
                    setError(
                      response?.message || 'Failed to send verification',
                    );
                  }
                } catch {
                  setError('Network error. Please try again.');
                  logReport({
                    type: 'function',
                    useraction: 'pushNewPhonenumber',
                    logMessage: 'Network error during phone number change',
                  });
                } finally {
                  setIsLoading(false);
                }
              }}
              disabled={!newPhone || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={modernStyles.primaryButtonText}>
                  Send Verification Code
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={modernStyles.secondaryButton}
              onPress={onCancel}
            >
              <Text style={modernStyles.secondaryButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ),
      },
      {
        title: 'Verify Phone',
        subtitle: 'Enter the 6-digit code sent to your new phone',
        content: (
          <View style={{}}>
            <View style={modernStyles.infoBox}>
              <IIcon
                name="call-outline"
                size={24}
                color={MODERN_COLORS.primary}
              />
              <Text style={modernStyles.infoText}>
                Code sent to:{' '}
                <Text style={{ fontWeight: 'bold' }}>{newPhone}</Text>
              </Text>
            </View>

            <View style={modernStyles.inputGroup}>
              <Text style={modernStyles.inputLabel}>Verification Code</Text>
              <BottomSheetTextInput
                style={modernStyles.input}
                placeholder="Enter 6-digit code"
                keyboardType="number-pad"
                maxLength={6}
                value={verificationCode}
                onChangeText={text => {
                  setVerificationCode(text.replace(/[^0-9]/g, ''));
                  setError('');
                }}
                editable={!isLoading}
              />
            </View>

            <TouchableOpacity
              style={modernStyles.resendButton}
              onPress={async () => {
                setIsLoading(true);
                try {
                  const response = await _http_request({
                    customApiUrl:
                      __CONFIG__.HTTPS_API_DOMAIN +
                      '/api/core/v1/pushNewPhonenumber',
                    reqType: 'POST',
                    bodyArray: {
                      oldpnumber: currentPhone.replace(/[^0-9]/g, ''),
                      newpnumber: newPhone.replace(/[^0-9]/g, ''),
                      rnc: '1',
                    },
                  });

                  if (response?.code === 200) {
                    Toastx.show({
                      type: 'success',
                      message: response.message ?? 'New code sent!',
                    });
                  } else {
                    Toastx.show({
                      type: 'error',
                      message: response?.message ?? 'Failed to resend code',
                    });
                  }
                } catch {
                  Toastx.show({
                    type: 'error',
                    message: 'Failed to resend code',
                  });
                  logReport({
                    type: 'function',
                    useraction: 'resendPhoneVerificationCode',
                    logMessage: 'Failed to resend phone verification code',
                  });
                } finally {
                  setIsLoading(false);
                }
              }}
              disabled={isLoading}
            >
              <Text style={modernStyles.resendButtonText}>Resend Code</Text>
            </TouchableOpacity>

            {error ? <Text style={modernStyles.errorText}>{error}</Text> : null}
            {successMessage ? (
              <Text style={modernStyles.successText}>{successMessage}</Text>
            ) : null}

            <View style={modernStyles.buttonRow}>
              <TouchableOpacity
                style={[modernStyles.secondaryButton, { flex: 1 }]}
                onPress={() => carouselRef.current?.goToPrevious()}
              >
                <Text style={modernStyles.secondaryButtonText}>Back</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  modernStyles.primaryButton,
                  { flex: 1 },
                  (verificationCode.length !== 6 || isLoading) &&
                    modernStyles.buttonDisabled,
                ]}
                onPress={async () => {
                  if (verificationCode.length !== 6) {
                    setError('Please enter a valid 6-digit code');
                    return;
                  }

                  setIsLoading(true);
                  try {
                    const response = await _http_request({
                      customApiUrl:
                        __CONFIG__.HTTPS_API_DOMAIN +
                        '/api/core/v1/pushNewPhonenumber',
                      reqType: 'POST',
                      bodyArray: {
                        oldpnumber: currentPhone.replace(/[^0-9]/g, ''),
                        newpnumber: newPhone.replace(/[^0-9]/g, ''),
                        vcode: verificationCode,
                      },
                    });

                    if (response?.code === 200) {
                      Dialogx.alert(
                        'Phone number updated',
                        'Use your new number the next time you sign in.',
                        undefined,
                        { tone: 'success', icon: 'call' },
                      );
                      onComplete();
                    } else {
                      setError(
                        response?.message || 'Invalid verification code',
                      );
                    }
                  } catch {
                    setError('Network error. Please try again.');
                    logReport({
                      type: 'function',
                      useraction: 'updatePhone',
                      logMessage: 'Network error during phone update',
                    });
                  } finally {
                    setIsLoading(false);
                  }
                }}
                disabled={verificationCode.length !== 6 || isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={modernStyles.primaryButtonText}>
                    Verify & Update
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ),
      },
    ];

    // Keyboard is handled by the sheet (keyboardBehavior + BottomSheetTextInput)
    return (
      <View style={{ flex: 1 }}>
        <ControlledCarousel
          ref={carouselRef}
          initialPage={0}
          onPageChange={setStep}
          pages={steps.map((stepConfig, index) => (
            <BottomSheetScrollView
              key={index}
              style={{ flex: 1 }}
              contentContainerStyle={{
                paddingHorizontal: 20,
                paddingBottom: 20,
              }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={modernStyles.flowHeader}>
                <Text style={modernStyles.flowTitle}>{stepConfig.title}</Text>
                <Text style={modernStyles.flowSubtitle}>
                  {stepConfig.subtitle}
                </Text>
              </View>
              {stepConfig.content}
            </BottomSheetScrollView>
          ))}
        />

        <View style={modernStyles.stepIndicator}>
          {steps.map((_, index) => (
            <View
              key={index}
              style={[
                modernStyles.stepDot,
                index === step && modernStyles.stepDotActive,
              ]}
            />
          ))}
        </View>
      </View>
    );
  };

  // Main render
  return (
    <>
      <SafeAreaView
        style={{ backgroundColor: colors.background, flex: 1 }}
        edges={['bottom']}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.conainerScrollView}
        >
          <SubscriptionCard
            profile={getProfile}
            navigation={navigation}
            onChanged={setProfile}
          />

          <View style={[{ paddingVertical: 20 }]}>
            {/* Quick Actions */}
            <QuickActions />

            {/* Account Settings Section */}
            <ModernSection title="Account" icon="person-outline">
              <ModernOption
                icon="mail-outline"
                title="Email Address"
                subtitle={profileEmail || 'Not set'}
                onPress={() => {
                  bottomSheetRef_email.ref.current?.snapToIndex(0);
                }}
              />
              <ModernOption
                icon="call-outline"
                title="Phone Number"
                subtitle={profilePhone || 'Not set'}
                onPress={() => {
                  bottomSheetRef_phone.ref.current?.snapToIndex(0);
                }}
                hr={false}
              />
            </ModernSection>

            {/* Appearance Section */}
            <ModernSection title="Appearance" icon="color-palette-outline">
              <AppearanceSwitcher />
            </ModernSection>

            {/* Privacy & Safety Section */}
            <ModernSection title="Privacy & Safety" icon="shield-outline">
              <ModernOption
                icon="lock-closed-outline"
                title="Privacy Settings"
                subtitle="Control who sees your profile"
                onPress={() => bottomSheetRef_privacy.ref.current?.expand()}
              />
              <ModernOption
                icon="warning-outline"
                title="Help & Safety"
                subtitle="Contact support or report a concern"
                onPress={() =>
                  Linking.openURL(__CONFIG__.HTTPS_DOMAIN + '/contact')
                }
                rightElement={<IIcon size={20} name="open-outline" />}
                hr={false}
              />
            </ModernSection>

            {/* Notifications Section */}
            <ModernSection title="Notifications" icon="notifications-outline">
              <ModernOption
                icon="notifications-outline"
                title="Notifications"
                subtitle="Push and email updates"
                onPress={() => {
                  bottomSheetRef_push.ref.current?.expand();
                }}
                hr={false}
              />
            </ModernSection>

            {/* Legal Section */}
            <ModernSection title="Legal" icon="document-text-outline">
              <ModernOption
                icon="reader-outline"
                title="Terms of Service"
                onPress={() =>
                  Linking.openURL(__CONFIG__.HTTPS_DOMAIN + '/terms')
                }
                rightElement={<IIcon size={20} name="open-outline" />}
              />
              <ModernOption
                icon="shield-checkmark-outline"
                title="Privacy Policy"
                onPress={() =>
                  Linking.openURL(__CONFIG__.HTTPS_DOMAIN + '/privacy')
                }
                rightElement={<IIcon size={20} name="open-outline" />}
                hr={false}
              />
            </ModernSection>

            {/* Red zone: things that end something */}
            <View style={modernStyles.dangerSection}>
              <ModernCard>
                {currentPlan.sub && !currentPlan.cancelPending && (
                  <ModernOption
                    icon="close-circle-outline"
                    title="Cancel Subscription"
                    subtitle={
                      currentPlan.platform === 1
                        ? `${currentPlan.title} · stops renewing, you keep it until the period ends`
                        : `${currentPlan.title} · managed in ${
                            currentPlan.platform === 2
                              ? 'the App Store'
                              : 'Google Play'
                          }`
                    }
                    onPress={() => confirmCancelPlan(getProfile, setProfile)}
                    danger
                  />
                )}

                <ModernOption
                  icon="log-out-outline"
                  title="Log Out"
                  onPress={async () => {
                    const ok = await Dialogx.confirm({
                      title: 'Log out?',
                      message: "You'll need your phone number to sign back in.",
                      confirmText: 'Log out',
                      destructive: true,
                      icon: 'log-out-outline',
                    });
                    if (!ok) return;
                    await AsyncStorage.removeItem(namer.storage.sessionId);
                    sessionManager.updateSession({ x_omi_payload: null });
                    if (navigation.canGoBack()) navigation.goBack();
                  }}
                  danger
                />

                <ModernOption
                  icon="trash-outline"
                  title="Delete Account"
                  onPress={async () => {
                    // A live plan changes what deleting means -- say so up front.
                    const planNote = !currentPlan.sub
                      ? ''
                      : currentPlan.platform === 1
                      ? `\n\nYour ${currentPlan.title} plan will be cancelled right away and you won't be charged again.`
                      : `\n\nYour ${currentPlan.title} plan is billed through ${
                          currentPlan.platform === 2
                            ? 'the App Store'
                            : 'Google Play'
                        } -- cancel it there too, or you'll keep being charged.`;
                    const ok = await Dialogx.confirm({
                      title: 'Delete your account?',
                      message: `This can't be undone. Your profile, matches and messages will be deleted immediately.${planNote}`,
                      confirmText: 'Delete account',
                      cancelText: 'Keep account',
                      destructive: true,
                      icon: 'trash',
                    });
                    if (!ok) return;
                    try {
                      const response = await _http_request({
                        customApiUrl:
                          __CONFIG__.HTTPS_API_DOMAIN +
                          '/api/core/v1/pushDeleteAccount',
                        reqType: 'POST',
                        bodyArray: { reason: 'user_requested' },
                      });
                      if (response?.code !== 200) {
                        throw new Error(
                          response?.message ?? 'Unable to delete account.',
                        );
                      }
                      await AsyncStorage.removeItem(namer.storage.sessionId);
                      sessionManager.updateSession({ x_omi_payload: null });
                      if (navigation.canGoBack()) navigation.goBack();
                    } catch (err: any) {
                      Dialogx.alert(
                        "Your account wasn't deleted",
                        err?.message ?? 'Please try again.',
                        undefined,
                        { tone: 'error' },
                      );
                    }
                  }}
                  danger
                  hr={false}
                />
              </ModernCard>
            </View>

            {/* Developer Section */}
            <View style={modernStyles.dangerSection}>
              <ModernCard>
                <ModernOption
                  icon="construct-outline"
                  title="Developer Tools"
                  onPress={() => {
                    navigation.push('zz_devv');
                  }}
                  hr={false}
                />
              </ModernCard>
            </View>

            {/* App Version */}
            <View style={modernStyles.versionContainer}>
              <Text style={modernStyles.versionText}>
                {DeviceInfo.getVersion()}:{DeviceInfo.getBuildNumber()}
              </Text>
              {apiBuild && (
                <Text style={modernStyles.versionSubText}>API: {apiBuild}</Text>
              )}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Bottom Sheets with keyboard configuration */}
      <BottomSheet
        ref={bottomSheetRef_email.ref}
        enablePanDownToClose
        index={-1}
        snapPoints={bottomSheetRef_email.snap}
        enableDynamicSizing={false}
        backdropComponent={bottomsheet_renderBackdrop}
        handleComponent={bottomsheet_renderHandle}
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
      >
        <EmailChangeFlow
          currentEmail={profileEmail}
          onCancel={() => bottomSheetRef_email.ref.current?.close()}
          onComplete={async () => {
            await __init__app();
            bottomSheetRef_email.ref.current?.close();
            setProfile(await cacheStorage.getCurrentUserProfile(true));
          }}
        />
        {/* Keeps the scroll area above the home indicator / nav bar */}
        <View style={{ height: safeInsets.bottom }} />
      </BottomSheet>

      <BottomSheet
        ref={bottomSheetRef_phone.ref}
        enablePanDownToClose
        index={-1}
        snapPoints={bottomSheetRef_phone.snap}
        enableDynamicSizing={false}
        backdropComponent={bottomsheet_renderBackdrop}
        handleComponent={bottomsheet_renderHandle}
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
      >
        <PhoneChangeFlow
          currentPhone={profilePhone}
          onComplete={async () => {
            await __init__app();
            bottomSheetRef_phone.ref.current?.close();
            setProfile(await cacheStorage.getCurrentUserProfile(true));
          }}
          onCancel={() => bottomSheetRef_phone.ref.current?.close()}
        />
        {/* Keeps the scroll area above the home indicator / nav bar */}
        <View style={{ height: safeInsets.bottom }} />
      </BottomSheet>

      <BottomSheet
        ref={bottomSheetRef_push.ref}
        index={-1}
        enablePanDownToClose
        backdropComponent={bottomsheet_renderBackdrop}
        handleComponent={bottomsheet_renderHandle}
      >
        <BottomSheetView
          style={{ padding: 23, paddingBottom: 23 + safeInsets.bottom }}
        >
          <View>
            <Text style={modernStyles.sectionTitle}>Notifications</Text>
            <Text style={[modernStyles.optionSubtitle, { marginTop: 6 }]}>
              Choose how you receive updates and alerts. Codes, receipts and
              security alerts are always emailed.
            </Text>

            <View style={{ marginTop: 16 }}>
              <ModernSwitch
                icon="notifications-outline"
                title="Push notifications"
                subtitle="Allow alerts on your device"
                value={notifyPushEnabled}
                onValueChange={setNotifyPushEnabled}
              />
              <ModernSwitch
                icon="mail-outline"
                title="Email notifications"
                subtitle={
                  hasRealEmail
                    ? 'New likes, matches and messages while you are away'
                    : 'Add an email address under Account to get these'
                }
                value={notifyEmailEnabled}
                onValueChange={setNotifyEmailEnabled}
              />
            </View>

            <View style={[modernStyles.buttonRow, { marginTop: 40 }]}>
              <TouchableOpacity
                style={[modernStyles.secondaryButton, { flex: 1 }]}
                onPress={resetNotificationSettings}
              >
                <Text style={modernStyles.secondaryButtonText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[modernStyles.primaryButton, { flex: 1 }]}
                onPress={saveNotificationSettings}
              >
                <Text style={modernStyles.primaryButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </BottomSheetView>
      </BottomSheet>

      <BottomSheet
        ref={bottomSheetRef_privacy.ref}
        index={-1}
        enablePanDownToClose
        backdropComponent={bottomsheet_renderBackdrop}
        handleComponent={bottomsheet_renderHandle}
      >
        <BottomSheetScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            padding: 23,
            paddingBottom: 23 + safeInsets.bottom,
          }}
        >
          <Text style={modernStyles.sectionTitle}>Privacy Settings</Text>
          <Text style={[modernStyles.optionSubtitle, { marginTop: 6 }]}>
            Control what information is visible on your profile.
          </Text>

          <View style={{ marginTop: 16 }}>
            <ModernSwitch
              icon="location-outline"
              title="Show my distance"
              subtitle="Allow people to see how far away you are"
              value={privacyShowDistance}
              onValueChange={setPrivacyShowDistance}
            />
            <ModernSwitch
              icon="calendar-outline"
              title="Show my age"
              subtitle="Display your age on your profile"
              value={privacyShowAge}
              onValueChange={setPrivacyShowAge}
            />
            <ModernSwitch
              icon="eye-off-outline"
              title="Incognito mode"
              subtitle="Only people you liked can see you"
              value={privacyIncognitoMode}
              onValueChange={setPrivacyIncognitoMode}
            />
            <ModernSwitch
              icon="checkmark-done-outline"
              title="Read receipts"
              subtitle="See when they've read your messages. Works only when you both have it on, and turning it off hides your reads too"
              value={privacyReadReceipts}
              onValueChange={setPrivacyReadReceipts}
              premiumLock
              hr={false}
            />
          </View>

          <View style={[modernStyles.buttonRow, { marginTop: 40 }]}>
            <TouchableOpacity
              style={[modernStyles.secondaryButton, { flex: 1 }]}
              onPress={resetPrivacySettings}
            >
              <Text style={modernStyles.secondaryButtonText}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[modernStyles.primaryButton, { flex: 1 }]}
              onPress={savePrivacySettings}
            >
              <Text style={modernStyles.primaryButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </BottomSheetScrollView>
      </BottomSheet>
    </>
  );
}

function createModernStyles(colors: ThemeColors) {
  return StyleSheet.create({
    flowHeader: {
      marginBottom: 18,
    },
    flowTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6,
    },
    flowSubtitle: {
      fontSize: 16,
      color: colors.textSecondary,
    },
    currentInfo: {
      backgroundColor: colors.border,
      padding: 11,
      borderRadius: 12,
      marginBottom: 16,
    },
    currentLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    currentValue: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    inputGroup: {
      gap: 8,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    input: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: colors.text,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    secondaryButton: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryButtonText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    errorText: {
      color: colors.error,
      fontSize: 14,
      textAlign: 'center',
      marginTop: 8,
    },
    successText: {
      color: colors.success,
      fontSize: 14,
      textAlign: 'center',
      marginTop: 8,
    },
    infoBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.border,
      padding: 16,
      borderRadius: 12,
      marginBottom: 16,
    },
    infoText: {
      fontSize: 14,
      color: colors.text,
      flex: 1,
    },
    resendButton: {
      alignSelf: 'center',
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    resendButtonText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '600',
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
    },
    stepIndicator: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 16,
    },
    stepDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.border,
    },
    stepDotActive: {
      backgroundColor: colors.primary,
      width: 12,
    },
    profileSubtitle: {
      fontSize: 14,
      color: 'rgba(255, 255, 255, 0.8)',
      marginBottom: 12,
    },
    statsContainer: {
      flexDirection: 'row',
      gap: 16,
    },
    stat: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    statText: {
      fontSize: 13,
      color: '#FFFFFF',
      fontWeight: '600',
    },
    editProfileButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    quickActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 30,
    },
    quickAction: {
      alignItems: 'center',
      flex: 1,
    },
    quickActionIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    quickActionText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
    },
    appearanceRow: {
      flexDirection: 'row',
      gap: 8,
      paddingVertical: 10,
    },
    appearanceOption: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.border,
    },
    appearanceOptionActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    appearanceOptionText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    appearanceOptionTextActive: {
      color: colors.onPrimary,
    },
    section: {
      marginBottom: 24,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      paddingHorizontal: 4,
    },
    sectionIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      paddingHorizontal: 16,
      ...Platform.select({
        ios: {
          shadowColor: colors.text,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.05,
          shadowRadius: 12,
        },
        android: {
          elevation: 3,
        },
      }),
    },
    hr: {
      // Horizontal divider style
      height: 1,
      backgroundColor: colors.border,
    },
    optionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
    },
    optionLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    optionIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    optionIconDanger: {
      backgroundColor: 'rgba(255, 59, 48, 0.1)',
    },
    optionIconPremium: {
      backgroundColor: 'rgba(255, 209, 102, 0.1)',
    },
    optionContent: {
      flex: 1,
    },
    optionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    optionTitleDanger: {
      color: colors.error,
    },
    optionSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    switchItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
    },
    switchLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    switchIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    switchContent: {
      flex: 1,
    },
    switchTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    switchSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    switchTrack: {
      width: 52,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.border,
      padding: 2,
      justifyContent: 'center',
    },
    switchTrackActive: {
      backgroundColor: colors.primary,
    },
    switchTrackDisabled: {
      backgroundColor: colors.textTertiary,
    },
    switchThumb: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.surface,
    },
    switchThumbActive: {
      transform: [{ translateX: 20 }],
    },
    dangerSection: {
      marginTop: 8,
      marginBottom: 32,
    },
    versionContainer: {
      alignItems: 'center',
      paddingTop: 10,
    },
    versionText: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    versionSubText: {
      fontSize: 12,
      color: colors.textTertiary,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
  });
}

export default Screen_settings;
