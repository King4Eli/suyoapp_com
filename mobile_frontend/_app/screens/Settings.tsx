import React, { useState, useRef, useMemo, useEffect, useLayoutEffect } from 'react';
import { View, Text,  StyleSheet, Linking, Alert, Share, TouchableOpacity, TextInput, Platform,  ActivityIndicator, KeyboardAvoidingView, ScrollView } from 'react-native';
 import { sessionManager } from '../funcs/SessionContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { namer, styles } from '../funcs/static';
import { __init__app, _http_request, cacheStorage, help, hostServer, logReport } from '../funcs/functions';
import appJson from '../../app.json';
import DeviceInfo from 'react-native-device-info';
import { SafeAreaView } from 'react-native-safe-area-context';
import IIcon from 'react-native-vector-icons/Ionicons';
import Feather from 'react-native-vector-icons/Feather';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { Toastx } from '../funcs/customNotification';
import { CarouselRef, ControlledCarousel } from '../funcs/customCarousel';
import { bottomsheet_renderBackdrop } from '../funcs/functions_stateful';
import { useHeaderHeight } from '@react-navigation/elements';

// Modern color palette
const MODERN_COLORS = {
  primary: '#FF3B6B', 
  surface: '#FFFFFF',  
  text: '#1F1F1F',
  textSecondary: '#666666',
  textTertiary: '#999999',
  border: '#E8E9FF',
  success: '#34C759', 
  error: '#FF3B30',
  premium: '#FFD166', 
};

export function Screen_settings({ navigation }: { navigation: any }) {
  const [getProfile, setProfile] = useState<any>(null);
  const headerHeight = useHeaderHeight();

  const [getAllowOnlyVerified, setAllowOnlyVerified] = useState(getProfile?.messagefromonlyverified ?? false);
  const [privacyShowInDiscovery, setPrivacyShowInDiscovery] = useState(true);
  const [privacyShowLastActive, setPrivacyShowLastActive] = useState(true);
  const [privacyShowDistance, setPrivacyShowDistance] = useState(true);
  const [privacyShowAge, setPrivacyShowAge] = useState(true);
  const [privacyIncognitoMode, setPrivacyIncognitoMode] = useState(false);
  const [privacyAllowMessageRequests, setPrivacyAllowMessageRequests] = useState(true);
  const [notifyPushEnabled, setNotifyPushEnabled] = useState(true);
  const [notifyEmailEnabled, setNotifyEmailEnabled] = useState(true);

  const subscriptionState = help.getSubscriptionState(getProfile);
  const activeSubscription = subscriptionState.hasActive;
  const profileDetails = getProfile?.profile ?? {};
  const profileEmail = profileDetails?.email ?? getProfile?.user_email ?? '';
  const profilePhone = profileDetails?.phonenumber ?? getProfile?.user_phonenumber ?? '';
  const profileName = profileDetails?.fullname ?? getProfile?.user_fullname ?? 'User';
  

  // Bottom sheet refs with larger snap points for keyboard
  const bottomSheetRef_push = {
    ref: useRef<BottomSheet>(null),
    snap: useMemo(() => ['65%'], [])
  };  
  const bottomSheetRef_email = {
    ref: useRef<BottomSheet>(null),
    snap: useMemo(() => ['55%'], []) // Increased for keyboard
  };
  const bottomSheetRef_phone = {
    ref: useRef<BottomSheet>(null),
    snap: useMemo(() => ['55%'], []) // Increased for keyboard
  }; 
  const bottomSheetRef_privacy = {
    ref: useRef<BottomSheet>(null),
    snap: useMemo(() => ['55%'], [])
  };

  const PRIVACY_STORAGE_KEY = 'privacy_settings_v1';
  const NOTIFICATION_STORAGE_KEY = 'notification_settings_v1';
  const privacyDefaults = {
    showInDiscovery: true,
    showLastActive: true,
    showDistance: true,
    showAge: true,
    incognitoMode: false,
    allowMessageRequests: true,
  };
  const notificationDefaults = {
    pushEnabled: true,
    emailEnabled: true,
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const profile = await cacheStorage.getCurrentUserProfile();
        if (mounted) setProfile(profile);
      } catch {
        if (mounted) setProfile(null);
      }
    })();

    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const loadPrivacySettings = async () => {
      try {
        const raw = await AsyncStorage.getItem(PRIVACY_STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        setPrivacyShowInDiscovery(parsed?.showInDiscovery ?? privacyDefaults.showInDiscovery);
        setPrivacyShowLastActive(parsed?.showLastActive ?? privacyDefaults.showLastActive);
        setPrivacyShowDistance(parsed?.showDistance ?? privacyDefaults.showDistance);
        setPrivacyShowAge(parsed?.showAge ?? privacyDefaults.showAge);
        setPrivacyIncognitoMode(parsed?.incognitoMode ?? privacyDefaults.incognitoMode);
        setPrivacyAllowMessageRequests(parsed?.allowMessageRequests ?? privacyDefaults.allowMessageRequests);
      } catch (err) {
        logReport({
          type: "function",
          useraction: "loadPrivacySettings",
          logMessage: "Failed to load privacy settings",
          stackTrace: err
        });
      }
    };
    const loadNotificationSettings = async () => {
      try {
        const raw = await AsyncStorage.getItem(NOTIFICATION_STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        setNotifyPushEnabled(parsed?.pushEnabled ?? notificationDefaults.pushEnabled);
        setNotifyEmailEnabled(parsed?.emailEnabled ?? notificationDefaults.emailEnabled);
      } catch (err) {
        logReport({
          type: "function",
          useraction: "loadNotificationSettings",
          logMessage: "Failed to load notification settings",
          stackTrace: err
        });
      }
    };
    loadPrivacySettings();
    loadNotificationSettings();
  }, []);


      useLayoutEffect(() => {
          navigation.setOptions({
              headerTransparent: true,
              headerTitle: ''
          });
      }, []);


 
  const saveNotificationSettings = async () => {
    try {
      await AsyncStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify({
        pushEnabled: notifyPushEnabled,
        emailEnabled: notifyEmailEnabled,
      }));
      Toastx.show({ type: "success", message: "Notification settings saved" });
      bottomSheetRef_push.ref.current?.close();
    } catch (err) {
      Toastx.show({ type: "error", message: "Failed to save notification settings" });
      logReport({
        type: "function",
        useraction: "saveNotificationSettings",
        logMessage: "Failed to save notification settings",
        stackTrace: err
      });
    }
  };

  const resetNotificationSettings = async () => {
    setNotifyPushEnabled(notificationDefaults.pushEnabled);
    setNotifyEmailEnabled(notificationDefaults.emailEnabled);
    try {
      await AsyncStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(notificationDefaults));
      Toastx.show({ type: "success", message: "Notification settings reset" });
    } catch (err) {
      Toastx.show({ type: "error", message: "Failed to reset notification settings" });
      logReport({
        type: "function",
        useraction: "resetNotificationSettings",
        logMessage: "Failed to reset notification settings",
        stackTrace: err
      });
    }
  };

  const savePrivacySettings = async () => {
    try {
      await AsyncStorage.setItem(PRIVACY_STORAGE_KEY, JSON.stringify({
        showInDiscovery: privacyShowInDiscovery,
        showLastActive: privacyShowLastActive,
        showDistance: privacyShowDistance,
        showAge: privacyShowAge,
        incognitoMode: privacyIncognitoMode,
        allowMessageRequests: privacyAllowMessageRequests,
      }));
      Toastx.show({ type: "success", message: "Privacy settings saved" });
      bottomSheetRef_privacy.ref.current?.close();
    } catch (err) {
      Toastx.show({ type: "error", message: "Failed to save privacy settings" });
      logReport({
        type: "function",
        useraction: "savePrivacySettings",
        logMessage: "Failed to save privacy settings",
        stackTrace: err
      });
    }
  };

  const resetPrivacySettings = async () => {
    setPrivacyShowInDiscovery(privacyDefaults.showInDiscovery);
    setPrivacyShowLastActive(privacyDefaults.showLastActive);
    setPrivacyShowDistance(privacyDefaults.showDistance);
    setPrivacyShowAge(privacyDefaults.showAge);
    setPrivacyIncognitoMode(privacyDefaults.incognitoMode);
    setPrivacyAllowMessageRequests(privacyDefaults.allowMessageRequests);
    try {
      await AsyncStorage.setItem(PRIVACY_STORAGE_KEY, JSON.stringify(privacyDefaults));
      Toastx.show({ type: "success", message: "Privacy settings reset" });
    } catch (err) {
      Toastx.show({ type: "error", message: "Failed to reset privacy settings" });
      logReport({
        type: "function",
        useraction: "resetPrivacySettings",
        logMessage: "Failed to reset privacy settings",
        stackTrace: err
      });
    }
  };

  // Profile header with modern design
  const ProfileHeader = () => (
    <View style={{backgroundColor:"red",padding:10,marginTop:2, borderRadius:15, flexDirection: 'row',alignItems: 'center',flex: 1,}}> 
           <View style={modernStyles.avatarContainer}>
            <View style={modernStyles.avatar}>
              <Text style={modernStyles.avatarText}>
                {profileName?.charAt(0) || 'U'}
              </Text>
            </View>
            {activeSubscription && (
              <View style={modernStyles.premiumBadge}>
                <Feather name="star" size={12} color="#FFF" />
              </View>
            )}
          </View>
          <View style={modernStyles.profileDetails}>
            <Text style={{fontSize: 22,fontWeight: 'bold',color: '#FFFFFF',marginBottom: 4,textTransform:"capitalize"}}>{profileName}</Text>
          </View>
     </View>
  );

  // Modern card component
  const ModernCard = ({ children, style }: any) => (
    <View style={[modernStyles.card, style]}>
      {children}
    </View>
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
    hr=true
  }: any) => (
    <TouchableOpacity
      style={[modernStyles.optionItem, hr && { borderBottomWidth: 1, borderBottomColor: MODERN_COLORS.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={modernStyles.optionLeft}>
        <View style={[
          modernStyles.optionIcon,
          danger && modernStyles.optionIconDanger,
          premium && modernStyles.optionIconPremium
        ]}>
          <IIcon
            name={icon}
            size={20}
            color={danger ? MODERN_COLORS.error : premium ? MODERN_COLORS.premium : MODERN_COLORS.primary}
          />
        </View>
        <View style={modernStyles.optionContent}>
          <Text style={[
            modernStyles.optionTitle,
            danger && modernStyles.optionTitleDanger
          ]}>
            {title}
          </Text>
          {subtitle && (
            <Text style={modernStyles.optionSubtitle}>{subtitle}</Text>
          )}
        </View>
      </View>
      {rightElement || (
        <IIcon name="chevron-forward" size={20} color={MODERN_COLORS.textTertiary} />
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
    hr=true
  }: any) => (
    <View style={[modernStyles.switchItem, hr && { borderBottomWidth: 1, borderBottomColor: MODERN_COLORS.border }]}>
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
          if (premiumLock && !subscriptionState.isVip) {
            Toastx.show({
              type: "warning",
              message: "Upgrade to VIP to unlock this feature",
              duration: 3000
            });
          } else {
            onValueChange(!value);
          }
        }}
        activeOpacity={0.7}
      >
        <View style={[
          modernStyles.switchTrack,
          value && modernStyles.switchTrackActive,
          premiumLock && !subscriptionState.isVip && modernStyles.switchTrackDisabled
        ]}>
          <View style={[
            modernStyles.switchThumb,
            value && modernStyles.switchThumbActive
          ]} />
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
      <ModernCard>
        {children}
      </ModernCard>
    </View>
  );

  // Quick actions bar
  const QuickActions = () => (
    <View style={modernStyles.quickActions}>
      <TouchableOpacity
        style={modernStyles.quickAction}
      > 
          <Feather name="help-circle" size={20} color="#FFF" />
         <Text style={modernStyles.quickActionText}>Support</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={modernStyles.quickAction}
      > 
          <Feather name="message-square" size={20} color="#FFF" />
         <Text style={modernStyles.quickActionText}>Feedback</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={modernStyles.quickAction}
        onPress={async () => {
          await Share.share({
            title: `Join me on ${appJson?.displayName}!`,
            message: `I'm using ${appJson?.displayName} to meet amazing people. Join me!`,
          });
        }}
      > 
          <Feather name="share-2" size={20} color="#FFF" />
         <Text style={modernStyles.quickActionText}>Share</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={modernStyles.quickAction}
      > 
          <Feather name="crown" size={20} color="#FFF" />
         <Text style={modernStyles.quickActionText}>Premium</Text>
      </TouchableOpacity>
    </View>
  );

  // Email Change Flow Component - FIXED KeyboardAvoidingView position
  const EmailChangeFlow = ({ currentEmail, onComplete, onCancel }: { currentEmail: string, onComplete: () => void, onCancel: () => void }) => {
    const [step, setStep] = useState(0);
    const [newEmail, setNewEmail] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const carouselRef = useRef<CarouselRef>(null);

    const steps = [
      {
        title: "Change Email",
        subtitle: "Enter your new email address",
        content: (
          <View style={{}}>
            <View style={modernStyles.currentInfo}>
              <Text style={modernStyles.currentLabel}>Current Email</Text>
              <Text style={modernStyles.currentValue}>{currentEmail}</Text>
            </View>

            <View style={modernStyles.inputGroup}>
              <Text style={modernStyles.inputLabel}>New Email Address</Text>
              <TextInput
                style={modernStyles.input}
                placeholder="your@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={newEmail}
                onChangeText={(text) => {
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
                (!newEmail || isLoading) && modernStyles.buttonDisabled
              ]}
              onPress={async () => {
                const trimmedEmail = newEmail.trim().toLowerCase();
                const trimmedCurrentEmail = currentEmail.trim().toLowerCase();
                if (!trimmedEmail || trimmedEmail === trimmedCurrentEmail) {
                  setError("Please enter a different email address");
                  return;
                }

                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(trimmedEmail)) {
                  setError("Please enter a valid email address");
                  return;
                }

                setIsLoading(true);
                setError('');

                try {
                  const response = await _http_request({
                    customApiUrl: hostServer() + "/api/core/v1/pushNewEmail",
                    reqType: 'POST',
                    bodyArray: {
                      oldemail: trimmedCurrentEmail,
                      newemail: trimmedEmail,
                      rnc: "1",
                    }
                  });

                  if (response?.code === 200) {
                    setNewEmail(trimmedEmail);
                    setSuccessMessage("Verification code sent to your new email");
                    carouselRef.current?.goToNext();
                  } else {
                    setError(response?.message || "Failed to send verification");
                  }
                } catch (err) {
                  setError("Network error. Please try again.");
                  logReport({
                    type: "function",
                    useraction: "pushNewEmail",
                    logMessage: "Network error during email change",
                    stackTrace: err
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
                <Text style={modernStyles.primaryButtonText}>Send Verification Code</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={modernStyles.secondaryButton}
              onPress={onCancel}
            >
              <Text style={modernStyles.secondaryButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )
      },
      {
        title: "Verify Email",
        subtitle: "Enter the 6-digit code sent to your new email",
        content: (
          <View style={{}}>
            <View style={modernStyles.infoBox}>
              <IIcon name="mail-outline" size={24} color={MODERN_COLORS.primary} />
              <Text style={modernStyles.infoText}>
                Code sent to: <Text style={{ fontWeight: 'bold' }}>{newEmail}</Text>
              </Text>
            </View>

            <View style={modernStyles.inputGroup}>
              <Text style={modernStyles.inputLabel}>Verification Code</Text>
              <TextInput
                style={modernStyles.input}
                placeholder="Enter 6-digit code"
                keyboardType="number-pad"
                maxLength={6}
                value={verificationCode}
                onChangeText={(text) => {
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
                    customApiUrl: hostServer() + "/api/core/v1/pushNewEmail",
                    reqType: 'POST',
                    bodyArray: {
                      oldemail: currentEmail.trim().toLowerCase(),
                      newemail: newEmail.trim().toLowerCase(),
                      rnc: "1",
                    }
                  });

                  if (response?.code === 200) {
                    Toastx.show({ type: "success", message: "New code sent!" });
                  }
                } catch (err) {
                  Toastx.show({ type: "error", message: "Failed to resend code" });
                  logReport({
                    type: "function",
                    useraction: "resendEmailVerificationCode",
                    logMessage: "Failed to resend email verification code",
                    stackTrace: err
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
            {successMessage ? <Text style={modernStyles.successText}>{successMessage}</Text> : null}

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
                  (verificationCode.length !== 6 || isLoading) && modernStyles.buttonDisabled
                ]}
                onPress={async () => {
                  if (verificationCode.length !== 6) {
                    setError("Please enter a valid 6-digit code");
                    return;
                  }

                  setIsLoading(true);
                  try {
                    const response = await _http_request({
                      customApiUrl: hostServer() + "/api/core/v1/pushNewEmail",
                      reqType: 'POST',
                      bodyArray: {
                        oldemail: currentEmail.trim().toLowerCase(),
                        newemail: newEmail.trim().toLowerCase(),
                        vcode: verificationCode,
                      }
                    });

                    if (response?.code === 200) {
                      Toastx.show({
                        type: "success",
                        message: "Email updated successfully!"
                      });
                      onComplete();
                    } else {
                      setError(response?.message || "Invalid verification code");
                    }
                  } catch (err) {
                    setError("Network error. Please try again.");
                    logReport({
                      type: "function",
                      useraction: "updateEmail",
                      logMessage: "Network error during email update",
                      stackTrace: err
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
                  <Text style={modernStyles.primaryButtonText}>Verify & Update</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )
      }
    ];

    // FIXED: KeyboardAvoidingView now properly wrapped inside BottomSheetView
    return (
      <BottomSheetView style={{ flex: 1 }}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"} 
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 0}
        >
          <ControlledCarousel ref={carouselRef} initialPage={0} onPageChange={setStep}
            pages={steps.map((stepConfig, index) => (
              <View key={index} style={{ flex: 1, paddingHorizontal: 10 }}>
                <View style={modernStyles.flowHeader}>
                  <Text style={modernStyles.flowTitle}>{stepConfig.title}</Text>
                  <Text style={modernStyles.flowSubtitle}>{stepConfig.subtitle}</Text>
                </View>
                {stepConfig.content}
              </View>
            ))} />

          <View style={modernStyles.stepIndicator}>
            {steps.map((_, index) => (
              <View
                key={index}
                style={[
                  modernStyles.stepDot,
                  index === step && modernStyles.stepDotActive
                ]}
              />
            ))}
          </View>
        </KeyboardAvoidingView>
      </BottomSheetView>
    );
  };

  // Phone Change Flow Component - FIXED KeyboardAvoidingView position
  const PhoneChangeFlow = ({
    currentPhone,
    onComplete,
    onCancel
  }: {
    currentPhone: string,
    onComplete: () => void,
    onCancel: () => void
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
        title: "Change Phone",
        subtitle: "Enter your new phone number",
        content: (
          <View style={{}}>
            <View style={modernStyles.currentInfo}>
              <Text style={modernStyles.currentLabel}>Current Phone</Text>
              <Text style={modernStyles.currentValue}>{currentPhone}</Text>
            </View>

            <View style={modernStyles.inputGroup}>
              <Text style={modernStyles.inputLabel}>New Phone Number</Text>
              <TextInput
                style={modernStyles.input}
                placeholder="+1 555 000 0000"
                keyboardType="phone-pad"
                autoCapitalize="none"
                value={newPhone}
                onChangeText={(text) => {
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
                (!newPhone || isLoading) && modernStyles.buttonDisabled
              ]}
              onPress={async () => {
                const trimmedPhone = newPhone.replace(/[^0-9]/g, '');
                const currentPhoneDigits = currentPhone.replace(/[^0-9]/g, '');
                if (!trimmedPhone || trimmedPhone === currentPhoneDigits) {
                  setError("Please enter a different phone number");
                  return;
                }
                if (trimmedPhone.length < 7) {
                  setError("Please enter a valid phone number");
                  return;
                }

                setIsLoading(true);
                setError('');

                try {
                  const response = await _http_request({
                    customApiUrl: hostServer() + "/api/core/v1/pushNewPhonenumber",
                    reqType: 'POST',
                    bodyArray: {
                      oldpnumber: currentPhoneDigits,
                      newpnumber: trimmedPhone,
                      rnc: "1",
                    }
                  });

                  if (response?.code === 200) {
                    setSuccessMessage("Verification code sent to your new phone");
                    carouselRef.current?.goToNext();
                  } else {
                    setError(response?.message || "Failed to send verification");
                  }
                } catch (err) {
                  setError("Network error. Please try again.");
                  logReport({
                    type: "function",
                    useraction: "pushNewPhonenumber",
                    logMessage: "Network error during phone number change",
                    stackTrace: err
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
                <Text style={modernStyles.primaryButtonText}>Send Verification Code</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={modernStyles.secondaryButton}
              onPress={onCancel}
            >
              <Text style={modernStyles.secondaryButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )
      },
      {
        title: "Verify Phone",
        subtitle: "Enter the 6-digit code sent to your new phone",
        content: (
          <View style={{}}>
            <View style={modernStyles.infoBox}>
              <IIcon name="call-outline" size={24} color={MODERN_COLORS.primary} />
              <Text style={modernStyles.infoText}>
                Code sent to: <Text style={{ fontWeight: 'bold' }}>{newPhone}</Text>
              </Text>
            </View>

            <View style={modernStyles.inputGroup}>
              <Text style={modernStyles.inputLabel}>Verification Code</Text>
              <TextInput
                style={modernStyles.input}
                placeholder="Enter 6-digit code"
                keyboardType="number-pad"
                maxLength={6}
                value={verificationCode}
                onChangeText={(text) => {
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
                    customApiUrl: hostServer() + "/api/core/v1/pushNewPhonenumber",
                    reqType: 'POST',
                    bodyArray: {
                      oldpnumber: currentPhone.replace(/[^0-9]/g, ''),
                      newpnumber: newPhone.replace(/[^0-9]/g, ''),
                      rnc: "1",
                    }
                  });

                  if (response?.code === 200) {
                    Toastx.show({ type: "success", message: "New code sent!" });
                  }
                } catch (err) {
                  Toastx.show({ type: "error", message: "Failed to resend code" });
                  logReport({
                    type: "function",
                    useraction: "resendPhoneVerificationCode",
                    logMessage: "Failed to resend phone verification code",
                    stackTrace: err
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
            {successMessage ? <Text style={modernStyles.successText}>{successMessage}</Text> : null}

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
                  (verificationCode.length !== 6 || isLoading) && modernStyles.buttonDisabled
                ]}
                onPress={async () => {
                  if (verificationCode.length !== 6) {
                    setError("Please enter a valid 6-digit code");
                    return;
                  }

                  setIsLoading(true);
                  try {
                    const response = await _http_request({
                      customApiUrl: hostServer() + "/api/core/v1/pushNewPhonenumber",
                      reqType: 'POST',
                      bodyArray: {
                        oldpnumber: currentPhone.replace(/[^0-9]/g, ''),
                        newpnumber: newPhone.replace(/[^0-9]/g, ''),
                        vcode: verificationCode,
                      }
                    });

                    if (response?.code === 200) {
                      Toastx.show({
                        type: "success",
                        message: "Phone number updated successfully!"
                      });
                      onComplete();
                    } else {
                      setError(response?.message || "Invalid verification code");
                    }
                  } catch (err) {
                    setError("Network error. Please try again.");
                    logReport({
                      type: "function",
                      useraction: "updatePhone",
                      logMessage: "Network error during phone update",
                      stackTrace: err
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
                  <Text style={modernStyles.primaryButtonText}>Verify & Update</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )
      }
    ];

    // FIXED: KeyboardAvoidingView now properly wrapped inside BottomSheetView
    return (
      <BottomSheetView style={{ flex: 1 }}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"} 
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 0}
        >
          <ControlledCarousel ref={carouselRef} initialPage={0} onPageChange={setStep}
            pages={steps.map((stepConfig, index) => (
              <View key={index} style={{ flex: 1, paddingHorizontal: 10 }}>
                <View style={modernStyles.flowHeader}>
                  <Text style={modernStyles.flowTitle}>{stepConfig.title}</Text>
                  <Text style={modernStyles.flowSubtitle}>{stepConfig.subtitle}</Text>
                </View>
                {stepConfig.content}
              </View>
            ))} />

          <View style={modernStyles.stepIndicator}>
            {steps.map((_, index) => (
              <View key={index} style={[modernStyles.stepDot, index === step && modernStyles.stepDotActive]} />
            ))}
          </View>
        </KeyboardAvoidingView>
      </BottomSheetView>
    );
  };

  // Main render
  return (
    <>
      <SafeAreaView style={{ backgroundColor:"#fff" , flex:1, paddingTop: headerHeight}} edges={["bottom"]}>
        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.conainerScrollView}
        >
          <ProfileHeader />

          <View style={[ { paddingVertical: 20, }]}>
            {/* Quick Actions */}
            <QuickActions />

            {/* Account Settings Section */}
            <ModernSection title="Account" icon="person-outline">
              <ModernOption
                icon="mail-outline"
                title="Email Address"
                subtitle={profileEmail || 'Not set'}
                onPress={() => {
                  bottomSheetRef_email.ref.current?.expand();
                }}
              />
               <ModernOption
                icon="call-outline"
                title="Phone Number"
                subtitle={profilePhone || 'Not set'}
                onPress={() => {
                  bottomSheetRef_phone.ref.current?.expand();
                }}
                hr={false}
              />
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
                title="Safety Center"
                subtitle="Learn about dating safely"
                onPress={() => Linking.openURL(hostServer() + "/static_page/tnc.php")}
                rightElement={<IIcon size={20} name='open-outline' />}
              />
              <ModernOption
                icon="notifications-outline"
                title="Push Notifications"
                subtitle="Manage alerts and preferences"
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
                onPress={() => Linking.openURL(hostServer() + "/static_page/tnc.php")}
                rightElement={<IIcon size={20} name='open-outline' />}
              />
              <ModernOption
                icon="shield-checkmark-outline"
                title="Privacy Policy"
                onPress={() => Linking.openURL(hostServer() + "/static_page/privacy.php")}
                rightElement={<IIcon size={20} name='open-outline' />}
                hr={false}
              />
            </ModernSection>

            {/* Logout & Delete Section */}
            <View style={modernStyles.dangerSection}>
              <ModernCard>
                <ModernOption
                  icon="log-out-outline"
                  title="Log Out"
                  onPress={async () => {
                    await AsyncStorage.removeItem(namer.storage.sessionId);
                    sessionManager.updateSession({ x_omi_payload: null, x_omi_payload_hash: null });
                    navigation.canGoBack() ? navigation.goBack() : null;
                  }}
                  danger />

                <ModernOption
                icon="trash-outline"
                title="Delete Account"
                onPress={() => {
                  Alert.alert(
                    "Delete Account?",
                    "This action cannot be undone. All your data will be permanently deleted.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: () => {
                          Toastx.show({ type: "success", message: "Account deletion requested" });
                        }
                      },
                    ]
                  );
                }}
                danger
                />

              <ModernOption
                icon="help-circle-outline"
                title="DEV Tool"
                onPress={() => { navigation.push("zz_devv"); }}
                hr={false}
              />
              </ModernCard>

            </View>

            {/* App Version */}
            <View style={modernStyles.versionContainer}>
              <Text style={modernStyles.versionText}> dv-{DeviceInfo.getVersion()} (jv-{appJson?.appversion})</Text>
              <Text style={modernStyles.buildText}>
                Build {DeviceInfo.getBuildNumber()} • Bundle {appJson?.bundlebuildnumber}
              </Text>
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
        backdropComponent={bottomsheet_renderBackdrop}
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
      >
      <BottomSheetView style={{ padding: 20 }}>
        <EmailChangeFlow 
          currentEmail={profileEmail}
          onCancel={() => bottomSheetRef_email.ref.current?.close()}
          onComplete={async () => {
            await __init__app();
            bottomSheetRef_email.ref.current?.close();
            setProfile(await cacheStorage.getCurrentUserProfile(true));
          }}  
        />
        </BottomSheetView>
      </BottomSheet>

      <BottomSheet 
        ref={bottomSheetRef_phone.ref} 
        enablePanDownToClose 
        index={-1}
        snapPoints={bottomSheetRef_phone.snap}
        backdropComponent={bottomsheet_renderBackdrop}
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
      > 
      <BottomSheetView style={{ padding: 20 }}>
        <PhoneChangeFlow 
          currentPhone={profilePhone}
          onComplete={async () => {
            await __init__app();
            bottomSheetRef_phone.ref.current?.close();
            setProfile(await cacheStorage.getCurrentUserProfile(true));
          }}
          onCancel={() => bottomSheetRef_phone.ref.current?.close()} 
        />
        </BottomSheetView>
      </BottomSheet>


      <BottomSheet 
        ref={bottomSheetRef_push.ref} 
        index={-1} 
        enablePanDownToClose
        snapPoints={bottomSheetRef_push.snap}
        backdropComponent={bottomsheet_renderBackdrop}
      >
        <BottomSheetView style={{ padding: 23 }}>
          <View style={{ flex: 1 }}>
            <Text style={modernStyles.sectionTitle}>Push Notifications</Text>
            <Text style={[modernStyles.optionSubtitle, { marginTop: 6 }]}>
              Choose how you receive updates and alerts.
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
                subtitle="Receive updates by email"
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
        snapPoints={bottomSheetRef_privacy.snap}
        backdropComponent={bottomsheet_renderBackdrop}
      >
        <BottomSheetView style={{ flex: 1 }}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 23, paddingBottom: 40 }}
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
          </ScrollView>
        </BottomSheetView>
      </BottomSheet>
    </>
  );
}

const modernStyles = StyleSheet.create({
  flowHeader: {
    marginBottom: 18,
  },
  flowTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: MODERN_COLORS.text,
    marginBottom: 6,
  },
  flowSubtitle: {
    fontSize: 16,
    color: MODERN_COLORS.textSecondary,
  },
  currentInfo: {
    backgroundColor: MODERN_COLORS.border,
    padding: 11,
    borderRadius: 12,
    marginBottom: 16,
  },
  currentLabel: {
    fontSize: 12,
    color: MODERN_COLORS.textSecondary,
    marginBottom: 4,
  },
  currentValue: {
    fontSize: 16,
    fontWeight: '600',
    color: MODERN_COLORS.text,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: MODERN_COLORS.text,
  },
  input: {
    backgroundColor: MODERN_COLORS.surface,
    borderWidth: 1,
    borderColor: MODERN_COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: MODERN_COLORS.text,
  },
  primaryButton: {
    backgroundColor: MODERN_COLORS.primary,
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
    backgroundColor: MODERN_COLORS.surface,
    borderWidth: 1,
    borderColor: MODERN_COLORS.border,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: MODERN_COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  errorText: {
    color: MODERN_COLORS.error,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  successText: {
    color: MODERN_COLORS.success,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: MODERN_COLORS.border,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 14,
    color: MODERN_COLORS.text,
    flex: 1,
  },
  resendButton: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  resendButtonText: {
    color: MODERN_COLORS.primary,
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
    backgroundColor: MODERN_COLORS.border,
  },
  stepDotActive: {
    backgroundColor: MODERN_COLORS.primary,
    width: 12,
  }, 
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  avatarText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  premiumBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: MODERN_COLORS.premium,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileDetails: {
    marginLeft: 16,
    flex: 1,
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
    color: MODERN_COLORS.text,
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
    backgroundColor: MODERN_COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: MODERN_COLORS.text,
  },
  card: {
    backgroundColor: MODERN_COLORS.surface,
    borderRadius: 18,
    paddingHorizontal: 16, 
    ...Platform.select({
      ios: {
        shadowColor: MODERN_COLORS.text,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
      },
      android: {
        elevation: 3,
      },
    }),
  }, 
  hr:{// Horizontal divider style
    height: 1,
    backgroundColor: MODERN_COLORS.border,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12
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
    backgroundColor: MODERN_COLORS.border,
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
    color: MODERN_COLORS.text,
    marginBottom: 2,
  },
  optionTitleDanger: {
    color: MODERN_COLORS.error,
  },
  optionSubtitle: {
    fontSize: 13,
    color: MODERN_COLORS.textSecondary,
  },
  switchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14
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
    backgroundColor: MODERN_COLORS.border,
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
    color: MODERN_COLORS.text,
    marginBottom: 2,
  },
  switchSubtitle: {
    fontSize: 13,
    color: MODERN_COLORS.textSecondary,
  },
  switchTrack: {
    width: 52,
    height: 32,
    borderRadius: 16,
    backgroundColor: MODERN_COLORS.border,
    padding: 2,
    justifyContent: 'center',
  },
  switchTrackActive: {
    backgroundColor: MODERN_COLORS.primary,
  },
  switchTrackDisabled: {
    backgroundColor: MODERN_COLORS.textTertiary,
  },
  switchThumb: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: MODERN_COLORS.surface,
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
    color: MODERN_COLORS.textSecondary,
    marginBottom: 4,
  },
  buildText: {
    fontSize: 11,
    color: MODERN_COLORS.textTertiary,
  },
});

export default Screen_settings;
