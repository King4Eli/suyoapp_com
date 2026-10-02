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
} from '@gorhom/bottom-sheet';
import { Toastx } from '../funcs/customNotification';
import { onPaymentRefreshed } from '../funcs/functions/paymentNotices';
import { CarouselRef, ControlledCarousel } from '../funcs/customCarousel';
import {
  bottomsheet_renderBackdrop,
  bottomsheet_renderHandle,
  bottomsheet_renderBackground,
} from '../funcs/functions_stateful';
import { useTheme, ThemeMode, ThemeColors } from '../funcs/theme';
import { useUnits, UnitSystem } from '../funcs/units';
import {
  SubscriptionCard,
  confirmCancelPlan,
  describePlan,
} from '../funcs/customSubscriptionCard';

export function Screen_settings({ navigation }: { navigation: any }) {
  const [getProfile, setProfile] = useState<any>(null);
  const { colors, mode, setMode, resolvedScheme } = useTheme();
  const { unit, setUnit } = useUnits();
  const MODERN_COLORS = colors;
  const modernStyles = useMemo(() => createModernStyles(colors), [colors]);
  // Shared by every text field in the sheets so placeholder, caret and keyboard
  // follow the active theme instead of the platform defaults.
  const sheetInputProps = {
    placeholderTextColor: colors.placeholder,
    selectionColor: colors.primary,
    cursorColor: colors.primary,
    keyboardAppearance: resolvedScheme,
  } as const;

  const [privacyShowDistance, setPrivacyShowDistance] = useState(true);
  const [privacyShowAge, setPrivacyShowAge] = useState(true);
  const [privacyIncognitoMode, setPrivacyIncognitoMode] = useState(false);
  const [privacyReadReceipts, setPrivacyReadReceipts] = useState(false);

  const subscriptionState = help.getSubscriptionState(getProfile);
  const currentPlan = describePlan(getProfile);
  // Which API build answered last (X-Api-Build), shown under the app version.
  const [apiBuild, setApiBuild] = useState<string | null>(null);
  useEffect(() => {
    getApiBuild().then(setApiBuild);
  }, []);
  const profileDetails = getProfile?.profile ?? {};
  const profileEmail = profileDetails?.email ?? getProfile?.user_email ?? '';
  const profilePhone =
    profileDetails?.phonenumber ?? getProfile?.user_phonenumber ?? '';

  const safeInsets = useSafeAreaInsets();

  // Row subtitles for Settings > Notifications; the detail lives on each screen.
  const notifySummary = (channel: 'push' | 'email') => {
    const n = profileDetails?.notifications;
    if (n && n[channel] === false) return 'Off';
    if (channel === 'email' && !profileEmail)
      return 'Add an email to get these';
    return 'Likes, matches, messages and more';
  };

  // The privacy sheet sizes to its content; email/phone hold a carousel that
  // needs a fixed height (its pages scroll when the content doesn't fit)
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
  ]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerStyle: { backgroundColor: colors.background },
      headerShadowVisible: false,
      headerTitle: '',
    });
  }, [navigation, colors.background]);

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
        <View style={modernStyles.quickActionIcon}>
          <Feather name="help-circle" size={22} color={MODERN_COLORS.primary} />
        </View>
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
        <View style={modernStyles.quickActionIcon}>
          <Feather name="share-2" size={22} color={MODERN_COLORS.primary} />
        </View>
        <Text style={modernStyles.quickActionText}>Share</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={modernStyles.quickAction}
        onPress={() => navigation.navigate(namer.navigation.subscription)}
      >
        <View style={modernStyles.quickActionIcon}>
          <IIcon
            name="diamond-outline"
            size={22}
            color={MODERN_COLORS.premium}
          />
        </View>
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
                size={15}
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

  // Units: how distances and heights are shown (display only)
  const UnitsSwitcher = () => {
    const options: { key: UnitSystem; label: string; hint: string }[] = [
      { key: 'imperial', label: 'Imperial', hint: 'mi · ft/in' },
      { key: 'metric', label: 'Metric', hint: 'km · cm' },
    ];
    return (
      <View style={modernStyles.appearanceRow}>
        {options.map(opt => {
          const active = unit === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              onPress={() => setUnit(opt.key)}
              activeOpacity={0.8}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              style={[
                modernStyles.appearanceOption,
                active && modernStyles.appearanceOptionActive,
              ]}
            >
              <Text
                style={[
                  modernStyles.appearanceOptionText,
                  active && modernStyles.appearanceOptionTextActive,
                ]}
              >
                {opt.label}
              </Text>
              <Text
                style={[
                  modernStyles.appearanceOptionText,
                  { fontWeight: '400' },
                  active && modernStyles.appearanceOptionTextActive,
                ]}
              >
                {opt.hint}
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
        icon: 'mail-outline',
        subtitle: 'Enter your new email address',
        content: (
          <View>
            <View style={modernStyles.currentInfo}>
              <IIcon
                name="mail-outline"
                size={18}
                color={MODERN_COLORS.textSecondary}
              />
              <View style={{ flex: 1 }}>
                <Text style={modernStyles.currentLabel}>Current Email</Text>
                <Text style={modernStyles.currentValue}>
                  {currentEmail || 'None yet'}
                </Text>
              </View>
            </View>

            <View style={modernStyles.inputGroup}>
              <Text style={modernStyles.inputLabel}>New Email Address</Text>
              <BottomSheetTextInput
                {...sheetInputProps}
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

            <View style={modernStyles.flowActions}>
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
                        __CONFIG__.HTTPS_API_DOMAIN +
                        '/api/core/v1/pushNewEmail',
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
                  <ActivityIndicator size="small" color={colors.onPrimary} />
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
          </View>
        ),
      },
      {
        title: 'Verify Email',
        icon: 'shield-checkmark-outline',
        subtitle: 'Enter the 6-digit code sent to your new email',
        content: (
          <View>
            <View style={modernStyles.infoBox}>
              <IIcon
                name="mail-outline"
                size={24}
                color={MODERN_COLORS.primary}
              />
              <Text style={modernStyles.infoText}>
                Code sent to:{' '}
                <Text style={modernStyles.infoTextStrong}>{newEmail}</Text>
              </Text>
            </View>

            <View style={modernStyles.inputGroup}>
              <Text style={modernStyles.inputLabel}>Verification Code</Text>
              <BottomSheetTextInput
                {...sheetInputProps}
                style={[modernStyles.input, modernStyles.codeInput]}
                placeholder="000000"
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
              <Text style={modernStyles.resendHint}>
                Didn't get it?{' '}
                <Text style={modernStyles.resendButtonText}>Resend code</Text>
              </Text>
            </TouchableOpacity>

            {error ? <Text style={modernStyles.errorText}>{error}</Text> : null}
            {successMessage ? (
              <Text style={modernStyles.successText}>{successMessage}</Text>
            ) : null}

            <View style={[modernStyles.buttonRow, modernStyles.flowActions]}>
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
                  <ActivityIndicator size="small" color={colors.onPrimary} />
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
                paddingTop: 4,
                paddingBottom: 24,
              }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={modernStyles.flowHeader}>
                <View style={modernStyles.flowHeaderIcon}>
                  <IIcon
                    name={stepConfig.icon}
                    size={22}
                    color={MODERN_COLORS.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={modernStyles.flowTitle}>{stepConfig.title}</Text>
                  <Text style={modernStyles.flowSubtitle}>
                    {stepConfig.subtitle}
                  </Text>
                </View>
              </View>
              {stepConfig.content}
            </BottomSheetScrollView>
          ))}
        />
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
        icon: 'call-outline',
        subtitle: 'Enter your new phone number',
        content: (
          <View>
            <View style={modernStyles.currentInfo}>
              <IIcon
                name="call-outline"
                size={18}
                color={MODERN_COLORS.textSecondary}
              />
              <View style={{ flex: 1 }}>
                <Text style={modernStyles.currentLabel}>Current Phone</Text>
                <Text style={modernStyles.currentValue}>
                  {currentPhone || 'None yet'}
                </Text>
              </View>
            </View>

            <View style={modernStyles.inputGroup}>
              <Text style={modernStyles.inputLabel}>New Phone Number</Text>
              <BottomSheetTextInput
                {...sheetInputProps}
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

            <View style={modernStyles.flowActions}>
              <TouchableOpacity
                style={[
                  modernStyles.primaryButton,
                  (!newPhone || isLoading) && modernStyles.buttonDisabled,
                ]}
                onPress={async () => {
                  const trimmedPhone = newPhone.replace(/[^0-9]/g, '');
                  const currentPhoneDigits = currentPhone.replace(
                    /[^0-9]/g,
                    '',
                  );
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
                  <ActivityIndicator size="small" color={colors.onPrimary} />
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
          </View>
        ),
      },
      {
        title: 'Verify Phone',
        icon: 'shield-checkmark-outline',
        subtitle: 'Enter the 6-digit code sent to your new phone',
        content: (
          <View>
            <View style={modernStyles.infoBox}>
              <IIcon
                name="call-outline"
                size={24}
                color={MODERN_COLORS.primary}
              />
              <Text style={modernStyles.infoText}>
                Code sent to:{' '}
                <Text style={modernStyles.infoTextStrong}>{newPhone}</Text>
              </Text>
            </View>

            <View style={modernStyles.inputGroup}>
              <Text style={modernStyles.inputLabel}>Verification Code</Text>
              <BottomSheetTextInput
                {...sheetInputProps}
                style={[modernStyles.input, modernStyles.codeInput]}
                placeholder="000000"
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
              <Text style={modernStyles.resendHint}>
                Didn't get it?{' '}
                <Text style={modernStyles.resendButtonText}>Resend code</Text>
              </Text>
            </TouchableOpacity>

            {error ? <Text style={modernStyles.errorText}>{error}</Text> : null}
            {successMessage ? (
              <Text style={modernStyles.successText}>{successMessage}</Text>
            ) : null}

            <View style={[modernStyles.buttonRow, modernStyles.flowActions]}>
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
                  <ActivityIndicator size="small" color={colors.onPrimary} />
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
                paddingTop: 4,
                paddingBottom: 24,
              }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={modernStyles.flowHeader}>
                <View style={modernStyles.flowHeaderIcon}>
                  <IIcon
                    name={stepConfig.icon}
                    size={22}
                    color={MODERN_COLORS.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={modernStyles.flowTitle}>{stepConfig.title}</Text>
                  <Text style={modernStyles.flowSubtitle}>
                    {stepConfig.subtitle}
                  </Text>
                </View>
              </View>
              {stepConfig.content}
            </BottomSheetScrollView>
          ))}
        />
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

            {/* Units Section */}
            <ModernSection title="Units" icon="resize-outline">
              <UnitsSwitcher />
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
                rightElement={
                  <IIcon
                    size={20}
                    name="open-outline"
                    color={MODERN_COLORS.textTertiary}
                  />
                }
                hr={false}
              />
            </ModernSection>

            {/* Notifications Section */}
            <ModernSection title="Notifications" icon="notifications-outline">
              <ModernOption
                icon="phone-portrait-outline"
                title="Push"
                subtitle={notifySummary('push')}
                onPress={() =>
                  navigation.navigate(namer.navigation.notificationSettings, {
                    channel: 'push',
                  })
                }
              />
              <ModernOption
                icon="mail-outline"
                title="Email"
                subtitle={notifySummary('email')}
                onPress={() =>
                  navigation.navigate(namer.navigation.notificationSettings, {
                    channel: 'email',
                  })
                }
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
                rightElement={
                  <IIcon
                    size={20}
                    name="open-outline"
                    color={MODERN_COLORS.textTertiary}
                  />
                }
              />
              <ModernOption
                icon="shield-checkmark-outline"
                title="Privacy Policy"
                onPress={() =>
                  Linking.openURL(__CONFIG__.HTTPS_DOMAIN + '/privacy')
                }
                rightElement={
                  <IIcon
                    size={20}
                    name="open-outline"
                    color={MODERN_COLORS.textTertiary}
                  />
                }
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
                <Text style={modernStyles.versionSubText}>v-{apiBuild}</Text>
              )}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Bottom Sheets with keyboard configuration */}
      <BottomSheet
        backgroundComponent={bottomsheet_renderBackground}
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
        backgroundComponent={bottomsheet_renderBackground}
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
        backgroundComponent={bottomsheet_renderBackground}
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

// Low-emphasis fill from a theme hex colour (there's no dangerSoft token).
function resolveSoft(hex: string) {
  return `${hex}1F`;
}

function createModernStyles(colors: ThemeColors) {
  return StyleSheet.create({
    flowHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      marginBottom: 22,
    },
    flowHeaderIcon: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    flowTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 2,
    },
    flowSubtitle: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.textSecondary,
    },
    flowActions: {
      gap: 10,
      marginTop: 20,
    },
    currentInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.borderLight,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 14,
      marginBottom: 20,
    },
    currentLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 2,
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
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      marginLeft: 2,
    },
    input: {
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 16,
      minHeight: 52,
      fontSize: 16,
      color: colors.text,
    },
    codeInput: {
      fontSize: 22,
      fontWeight: '600',
      letterSpacing: 8,
      textAlign: 'center',
    },
    primaryButton: {
      backgroundColor: colors.primary,
      borderRadius: 14,
      minHeight: 52,
      paddingHorizontal: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonText: {
      color: colors.onPrimary,
      fontSize: 16,
      fontWeight: '600',
    },
    secondaryButton: {
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      minHeight: 52,
      paddingHorizontal: 16,
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
      fontSize: 13,
      marginTop: 8,
      marginLeft: 2,
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
      backgroundColor: colors.primarySoft,
      padding: 16,
      borderRadius: 12,
      marginBottom: 16,
    },
    infoText: {
      fontSize: 14,
      color: colors.text,
      flex: 1,
    },
    infoTextStrong: {
      fontWeight: '700',
      color: colors.text,
    },
    resendButton: {
      alignSelf: 'center',
      paddingVertical: 10,
      paddingHorizontal: 16,
      marginTop: 6,
    },
    resendHint: {
      color: colors.textSecondary,
      fontSize: 14,
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
      gap: 6,
      paddingTop: 2,
      paddingBottom: 14,
    },
    stepDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.border,
    },
    stepDotActive: {
      backgroundColor: colors.primary,
      width: 20,
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
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
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
      gap: 6,
      paddingVertical: 8,
    },
    appearanceOption: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingVertical: 8,
      borderRadius: 10,
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
          shadowColor: colors.shadow,
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
      backgroundColor: resolveSoft(colors.error),
    },
    optionIconPremium: {
      backgroundColor: colors.premiumSoft,
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
      // white in both themes: a surface-coloured thumb vanishes on the dark track
      backgroundColor: '#FFFFFF',
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
