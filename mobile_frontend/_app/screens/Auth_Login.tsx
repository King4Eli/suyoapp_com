import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {Animated,KeyboardAvoidingView,Linking,Platform,Pressable,StyleSheet,Text,TextInput,TouchableOpacity,View,} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { CountryPicker, CountryItem } from 'react-native-country-codes-picker';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CarouselRef, ControlledCarousel } from '../funcs/customCarousel';
import { __init__app, _handle_Signin, cacheStorage, getFriendlyNetworkErrorMessage, screenWidth } from '../funcs/functions';
import { Loaderx } from '../funcs/functions_stateful';
import { namer, __CONFIG__ } from '../funcs/static';
import { Toastx } from '../funcs/customNotification';
import { useTheme, ThemeColors } from '../funcs/theme';

const CODE_LENGTH = 6;
const INITIAL_RESEND_SECONDS = 80;

export const Auth_Login = () => {
  const { colors } = useTheme();
  const stylesx = useMemo(() => createStylesx(colors), [colors]);
  const navigation = useNavigation<any>();
  const carouselRef = useRef<CarouselRef>(null);
  const codeInputRefs = useRef<Array<TextInput | null>>([]);
  const resendAttemptRef = useRef(1);

  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode, setCountryCode] = useState('US');
  const [countryFlag, setCountryFlag] = useState('🇺🇸');
  const [callingCode, setCallingCode] = useState('1');
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [verificationCode, setVerificationCode] = useState<string[]>(() => Array(CODE_LENGTH).fill(''));
  const [showCreateAccountPrompt, setShowCreateAccountPrompt] = useState(false);
  const [codeSentMessage, setCodeSentMessage] = useState('');
  const [timer, setTimer] = useState(INITIAL_RESEND_SECONDS);
  const [isResendDisabled, setIsResendDisabled] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const normalizedPhone = useMemo(() => phoneNumber.replace(/\D/g, ''), [phoneNumber]);
  const fullPhoneNumber = useMemo(() => `+${callingCode}${normalizedPhone}`, [callingCode, normalizedPhone]);
  const isPhoneValid = useMemo(() => {
    const parsedPhone = parsePhoneNumberFromString(fullPhoneNumber);
    return normalizedPhone.startsWith('000000') || (parsedPhone?.isValid() ?? false);
  }, [fullPhoneNumber, normalizedPhone]);
  const verificationValue = verificationCode.join('');
  const resendLabel = `${Math.floor(timer / 60)}:${(timer % 60).toString().padStart(2, '0')}`;


  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
 
  //  (async()=>{
  //        const jsy=await cacheStorage.getMapper(true);
  //         console.log(jsy.gender);
  //      })();

    if (isResendDisabled) {
      interval = setInterval(() => {
        setTimer(prev => {
          if (prev <= 1) {
            if (interval) clearInterval(interval);
            setIsResendDisabled(false);
            return 0;
          }

          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isResendDisabled]);

  const animatePageChange = useCallback(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(24);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const resetCodeState = () => {
    setVerificationCode(Array(CODE_LENGTH).fill(''));
    setTimer(INITIAL_RESEND_SECONDS);
    setIsResendDisabled(true);
    resendAttemptRef.current = 1;
  };

  const handleCountrySelect = (country: CountryItem) => {
    setCountryCode(country.code);
    setCountryFlag(country.flag);
    setCallingCode(country.dial_code.replace('+', ''));
    setShowCountryPicker(false);
  };

  const requestCode = async (showSuccessToast = false) => {
    const response = await _handle_Signin(normalizedPhone, callingCode, null);

    if (!response) {
      Toastx.show({ type: 'error', message: 'Could not send a code. Try again.' });
      return false;
    }

    if (response.code === 200) {
      if (response.message) setCodeSentMessage(response.message);
      if (showSuccessToast) Toastx.show({ type: 'info', message: response.message ?? 'Code resent' });
      return true;
    }

    if (response.code === 404) {
      setShowCreateAccountPrompt(true);
      return false;
    }

    Toastx.show({ type: 'error', message: response.message ?? response.redirect ?? 'Unable to continue.' });
    return false;
  };

  const handleSendCode = async () => {
    if (!isPhoneValid || isSubmitting) return;

    setIsSubmitting(true);
    Loaderx.show();
    try {
      const sent = await requestCode();
      if (sent) {
        resetCodeState();
        carouselRef.current?.goToNext();
        animatePageChange();
      }
    } finally {
      Loaderx.hide();
      setIsSubmitting(false);
    }
  };

  const applyCodeInput = (text: string, index: number) => {
    const digits = text.replace(/\D/g, '').split('');
    const nextCode = [...verificationCode];

    if (digits.length > 0) {
      digits.slice(0, CODE_LENGTH - index).forEach((digit, digitIndex) => {
        nextCode[index + digitIndex] = digit;
      });
      setVerificationCode(nextCode);
      codeInputRefs.current[Math.min(index + digits.length, CODE_LENGTH - 1)]?.focus();
      return;
    }

    nextCode[index] = '';
    setVerificationCode(nextCode);
  };

  const handleCodeKeyPress = (event: any, index: number) => {
    if (event.nativeEvent.key === 'Backspace' && !verificationCode[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }
  };

  const handleResendCode = async () => {
    if (isResendDisabled || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const sent = await requestCode(true);
      if (sent) {
        setTimer(90 * resendAttemptRef.current);
        resendAttemptRef.current += 1;
        setIsResendDisabled(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyAndContinue = async () => {
    if (isSubmitting) return;

    if (verificationValue.length < CODE_LENGTH) {
      Toastx.show({ type: 'error', message: 'Enter the complete 6-digit code.' });
      return;
    }

    setIsSubmitting(true);
    Loaderx.show();
    try {
      const response = await _handle_Signin(normalizedPhone, callingCode, verificationValue);

      if (!response) {
        Toastx.show({ type: 'error', message: 'Error verifying account.' });
        return;
      }

      if (response.code === 200) {
        await Promise.all([
          __init__app(),
          cacheStorage.getCurrentUserProfile(true),
          cacheStorage.getProducts(true),
        ]);
        Toastx.show({ type: 'success', message: response.message ?? 'Verification successful.' });
        return;
      }

      if (response.code === 301) {
        Toastx.show({ type: 'info', message: response.message ?? 'Redirecting' });
        return;
      }

      Toastx.show({ type: 'error', message: response.message ?? response.redirect ?? 'Invalid code.' });
    } catch (error: any) {
      Toastx.show({ type: 'error', message: await getFriendlyNetworkErrorMessage(error, 'Error verifying account.') });
    } finally {
      Loaderx.hide();
      setIsSubmitting(false);
    }
  };

  const openTerms = () => Linking.openURL(`${__CONFIG__.HTTPS_DOMAIN}/static_page/tnc.php`);
  const openPrivacy = () => Linking.openURL(`${__CONFIG__.HTTPS_DOMAIN}/static_page/privacy.php`);

  const editPhoneNumber = () => {
    carouselRef.current?.goToPrevious();
    animatePageChange();
    resetCodeState();
    setCodeSentMessage('');
  };

  const renderLoginPage = () => (
    <AuthPage fadeAnim={fadeAnim} slideAnim={slideAnim} stylesx={stylesx}>
      <View style={stylesx.brandMark}>
        <MaterialCommunityIcons name="heart-multiple" size={36} color={'#fff'} />
      </View>

      <View style={stylesx.header}>
        <Text style={stylesx.title}>Find your next favorite person.</Text>
        <Text style={stylesx.subtitle}>Sign in with your phone number.</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={stylesx.formCard}>
        <Text style={stylesx.fieldLabel}>Phone number</Text>
        <View style={[stylesx.phoneInput, isPhoneValid && stylesx.phoneInputActive]}>
          <TouchableOpacity
            style={stylesx.countryPickerButton}
            onPress={() => setShowCountryPicker(true)}
            activeOpacity={0.7}
          >
            <Text style={stylesx.countryPickerButtonText}>{countryFlag} +{callingCode}</Text>
          </TouchableOpacity>
          <CountryPicker
            show={showCountryPicker}
            lang="en"
            pickerButtonOnPress={handleCountrySelect}
            onBackdropPress={() => setShowCountryPicker(false)}
          />
          <View style={stylesx.inputDivider} />
          <TextInput
            style={stylesx.input}
            placeholder="555 000 1234"
            placeholderTextColor={colors.placeholder}
            value={phoneNumber}
            onChangeText={value => setPhoneNumber(value.replace(/\D/g, ''))}
            keyboardType="number-pad"
            textContentType="telephoneNumber"
          />
        </View>
        <Text style={stylesx.helperText}>We will text you a one-time verification code.</Text>

        <PrimaryButton
          label={isSubmitting ? 'Sending...' : 'Continue with Phone'}
          disabled={!isPhoneValid || isSubmitting}
          onPress={handleSendCode}
          stylesx={stylesx}
        />

        <View style={stylesx.dividerRow}>
          <View style={stylesx.dividerLine} />
          <Text style={stylesx.dividerText}>or</Text>
          <View style={stylesx.dividerLine} />
        </View>

        <View style={stylesx.socialButtonsContainer}>
          <SocialButton icon="google" label="Google" color="#db4437" stylesx={stylesx} />
          <SocialButton icon="facebook" label="Facebook" color="#4267B2" stylesx={stylesx} />
        </View>
        {Platform.OS === 'ios' && <SocialButton icon="apple" label="Apple" color="#151515" stylesx={stylesx} />}
      </KeyboardAvoidingView>

      <TermsText onTerms={openTerms} onPrivacy={openPrivacy} stylesx={stylesx} />

      {showCreateAccountPrompt && (
        <CreateAccountPrompt
          phoneLabel={`+${callingCode} ${normalizedPhone}`}
          onCancel={() => setShowCreateAccountPrompt(false)}
          onCreate={() => {
            setShowCreateAccountPrompt(false);
            navigation.navigate(namer.navigation.signup, { phone: fullPhoneNumber});
          }}
          colors={colors}
          stylesx={stylesx}
        />
      )}
    </AuthPage>
  );

  const renderVerificationPage = () => {
    return (
      <AuthPage fadeAnim={fadeAnim} slideAnim={slideAnim} stylesx={stylesx}>
        <TouchableOpacity style={stylesx.backButton} onPress={editPhoneNumber}>
          <MaterialCommunityIcons name="chevron-left" size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={stylesx.verifyIcon}>
          <MaterialCommunityIcons name="message-text-lock-outline" size={38} color={colors.primary} />
        </View>

        <View style={stylesx.header}>
          <Text style={stylesx.title}>Enter your code</Text>
          <Text style={stylesx.subtitle}>{codeSentMessage || 'Enter the 6-digit code we sent you.'}</Text>
        </View>

        <View style={stylesx.formCard}>
          <View style={stylesx.codeStack}>
            {verificationCode.map((digit, index) => (
              <TextInput
                ref={ref => {
                  codeInputRefs.current[index] = ref;
                }}
                key={index}
                style={[stylesx.codeInput, !!digit && stylesx.codeInputActive]}
                value={digit}
                onChangeText={text => applyCodeInput(text, index)}
                onKeyPress={event => handleCodeKeyPress(event, index)}
                placeholder="0"
                placeholderTextColor={colors.placeholder}
                keyboardType="number-pad"
                maxLength={CODE_LENGTH}
                selectTextOnFocus
                textContentType="oneTimeCode"
              />
            ))}
          </View>

          <PrimaryButton
            label={isSubmitting ? 'Verifying...' : 'Verify & Continue'}
            disabled={verificationValue.length < CODE_LENGTH || isSubmitting}
            onPress={handleVerifyAndContinue}
            stylesx={stylesx}
          />

          <View style={stylesx.resendRow}>
            <Text style={stylesx.helperText}>{isResendDisabled ? `Resend in ${resendLabel}` : 'Did not get it?'}</Text>
            <TouchableOpacity
              style={[stylesx.resendButton, (isResendDisabled || isSubmitting) && stylesx.resendButtonDisabled]}
              disabled={isResendDisabled || isSubmitting}
              onPress={handleResendCode}>
              <Text style={stylesx.resendButtonText}>Resend code</Text>
            </TouchableOpacity>
          </View>
        </View>
      </AuthPage>
    );
  };

  return (
    <SafeAreaView style={stylesx.container} edges={['bottom', 'top']}>
      <ControlledCarousel
        ref={carouselRef}
        pages={[renderLoginPage(), renderVerificationPage()]}
        onPageChange={animatePageChange}
      />
    </SafeAreaView>
  );
};

const AuthPage = ({
  children,
  fadeAnim,
  slideAnim,
  stylesx,
}: {
  children: React.ReactNode;
  fadeAnim: Animated.Value;
  slideAnim: Animated.Value;
  stylesx: any;
}) => (
  <Animated.ScrollView
    style={stylesx.page}
    keyboardShouldPersistTaps="handled"
    showsVerticalScrollIndicator={false}
    contentContainerStyle={stylesx.pageContent}>
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], width: '100%' }}>
      {children}
    </Animated.View>
  </Animated.ScrollView>
);

const PrimaryButton = ({ label, disabled, onPress, stylesx }: { label: string; disabled?: boolean; onPress: () => void; stylesx: any }) => (
  <TouchableOpacity
    style={[stylesx.primaryButton, disabled && stylesx.primaryButtonDisabled]}
    disabled={disabled}
    onPress={onPress}>
    <Text style={stylesx.primaryButtonText}>{label}</Text>
  </TouchableOpacity>
);

const SocialButton = ({ icon, label, color, stylesx }: { icon: string; label: string; color: string; stylesx: any }) => (
  <Pressable style={[stylesx.socialButton, { backgroundColor: color }]} onPress={() => {}}>
    <MaterialCommunityIcons name={icon} size={20} color={'#fff'} />
    <Text style={stylesx.socialButtonText}>{label}</Text>
  </Pressable>
);

const TermsText = ({ onTerms, onPrivacy, stylesx }: { onTerms: () => void; onPrivacy: () => void; stylesx: any }) => (
  <View style={stylesx.termsWrap}>
    <Text style={stylesx.termsText}>By continuing, you agree to our </Text>
    <Pressable onPress={onTerms}>
      <Text style={stylesx.termsLink}>Terms</Text>
    </Pressable>
    <Text style={stylesx.termsText}> and </Text>
    <Pressable onPress={onPrivacy}>
      <Text style={stylesx.termsLink}>Privacy Policy</Text>
    </Pressable>
    <Text style={stylesx.termsText}>.</Text>
  </View>
);

const CreateAccountPrompt = ({
  phoneLabel,
  onCancel,
  onCreate,
  colors,
  stylesx,
}: {
  phoneLabel: string;
  onCancel: () => void;
  onCreate: () => void;
  colors: ThemeColors;
  stylesx: any;
}) => (
  <View style={stylesx.promptBackdrop}>
    <View style={stylesx.promptCard}>
      <View style={stylesx.promptIcon}>
        <MaterialCommunityIcons name="account-plus-outline" size={28} color={colors.primary} />
      </View>
      <Text style={stylesx.promptTitle}>No account yet</Text>
      <Text style={stylesx.promptText}>{phoneLabel}</Text>
      <Text style={stylesx.promptText}>Create a profile now and start matching in a few quick steps.</Text>
      <View style={stylesx.promptActions}>
        <TouchableOpacity style={[stylesx.promptButton, stylesx.promptButtonCancel]} onPress={onCancel}>
          <Text style={stylesx.promptButtonCancelText}>Not now</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[stylesx.promptButton, stylesx.promptButtonPrimary]} onPress={onCreate}>
          <Text style={stylesx.promptButtonPrimaryText}>Create account</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
);

function createStylesx(colors: ThemeColors) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  page: {
    width: screenWidth,
    flex: 1,
  },
  pageContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 22,
    justifyContent: 'center',
  },
  brandMark: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 7,
  },
  verifyIcon: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: colors.surface,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 22,
    elevation: 6,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 22,
    marginBottom: 22,
    gap: 10,
  },
  title: {
    color: colors.text,
    fontSize: 34,
    lineHeight: 39,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 16, 
    textAlign: 'center',
    maxWidth: 330,
  },
  formCard: {
    width: '100%',
    borderRadius: 20,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 30,
    gap: 14,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 22,
    elevation: 5,
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  phoneInput: {
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  phoneInputActive: {
    borderColor: colors.primary,
    backgroundColor: colors.backgroundSecondary,
  },
  countryPickerButton: {
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  countryPickerButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  inputDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
    marginHorizontal: 10,
  },
  input: {
    flex: 1,
    minHeight: 45,
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  helperText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  primaryButton: {
    width: '100%',
    minHeight: 45,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 5,
  },
  primaryButtonDisabled: {
    backgroundColor: colors.disabled,
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    color: colors.textTertiary,
    fontSize: 13,
    fontWeight: '800',
  },
  socialButtonsContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  socialButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  socialButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
  termsWrap: {
    marginTop: 20,
    paddingHorizontal: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  termsText: {
    color: colors.textTertiary,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  termsLink: {
    color: colors.primary,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '900',
  },
  codeStack: {
    flexDirection: 'row',
    gap: 7,
  },
  codeInput: {
    flex: 1,
    minHeight: 56,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '900',
    backgroundColor: colors.backgroundSecondary,
    color: colors.text,
  },
  codeInputActive: {
    borderColor: colors.primary,
    backgroundColor: colors.backgroundSecondary,
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  resendButton: {
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 9,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resendButtonDisabled: {
    opacity: 0.55,
  },
  resendButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  promptBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  promptCard: {
    width: '100%',
    borderRadius: 22,
    backgroundColor: colors.surface,
    padding: 20,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 26,
    elevation: 8,
  },
  promptIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundSecondary,
    marginBottom: 14,
  },
  promptTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  promptText: {
    marginTop: 9,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  promptActions: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 10,
  },
  promptButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptButtonCancel: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundSecondary,
  },
  promptButtonPrimary: {
    backgroundColor: colors.primary,
  },
  promptButtonCancelText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  promptButtonPrimaryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  });
}
