import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {Animated,KeyboardAvoidingView,Linking,Platform,Pressable,StyleSheet,Text,TextInput,TouchableOpacity,View,} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import CountryPicker, { Country, CountryCode } from 'react-native-country-picker-modal';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CarouselRef, ControlledCarousel } from '../funcs/customCarousel';
import { __init__app, _handle_Signin, cacheStorage, hostServer, screenWidth } from '../funcs/functions';
import { Loaderx } from '../funcs/functions_stateful';
import { namer } from '../funcs/static';
import { Toastx } from '../funcs/customNotification';

const CODE_LENGTH = 6;
const INITIAL_RESEND_SECONDS = 80;

export const Auth_Login = () => {
  const navigation = useNavigation<any>();
  const carouselRef = useRef<CarouselRef>(null);
  const codeInputRefs = useRef<Array<TextInput | null>>([]);
  const resendAttemptRef = useRef(1);

  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode, setCountryCode] = useState<CountryCode>('US');
  const [callingCode, setCallingCode] = useState('1');
  const [verificationCode, setVerificationCode] = useState<string[]>(() => Array(CODE_LENGTH).fill(''));
  const [showCreateAccountPrompt, setShowCreateAccountPrompt] = useState(false);
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
 
   (async()=>{
         const jsy=await cacheStorage.getMapper(true);
          console.log(jsy.gender);
       })();

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

  const handleCountrySelect = (country: Country) => {
    setCountryCode(country.cca2);
    setCallingCode(country.callingCode?.[0] ?? '1');
  };

  const requestCode = async (showSuccessToast = false) => {
    const response = await _handle_Signin(normalizedPhone, callingCode, null);

    if (!response) {
      Toastx.show({ type: 'error', message: 'Could not send a code. Try again.' });
      return false;
    }

    if (response.code === 200) {
      if (showSuccessToast) Toastx.show({ type: 'info', message: 'Code resent' });
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
    } finally {
      Loaderx.hide();
      setIsSubmitting(false);
    }
  };

  const openTerms = () => Linking.openURL(`${hostServer()}/static_page/tnc.php`);
  const openPrivacy = () => Linking.openURL(`${hostServer()}/static_page/privacy.php`);

  const editPhoneNumber = () => {
    carouselRef.current?.goToPrevious();
    animatePageChange();
    resetCodeState();
  };

  const renderLoginPage = () => (
    <AuthPage fadeAnim={fadeAnim} slideAnim={slideAnim}>
      <View style={stylesx.brandMark}>
        <MaterialCommunityIcons name="heart-multiple" size={36} color="#ffffff" />
      </View>

      <View style={stylesx.header}>
        <Text style={stylesx.title}>Find your next favorite person.</Text>
        <Text style={stylesx.subtitle}>Sign in with your phone number to keep your matches and chats close.</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={stylesx.formCard}>
        <Text style={stylesx.fieldLabel}>Phone number</Text>
        <View style={[stylesx.phoneInput, isPhoneValid && stylesx.phoneInputActive]}>
          <CountryPicker
            countryCode={countryCode}
            withFilter
            withFlag
            withCallingCode
            withCallingCodeButton
            withEmoji
            onSelect={handleCountrySelect}
            containerButtonStyle={stylesx.countryPickerButton}
          />
          <View style={stylesx.inputDivider} />
          <TextInput
            style={stylesx.input}
            placeholder="555 000 1234"
            placeholderTextColor="#a7959f"
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
        />

        <View style={stylesx.dividerRow}>
          <View style={stylesx.dividerLine} />
          <Text style={stylesx.dividerText}>or</Text>
          <View style={stylesx.dividerLine} />
        </View>

        <View style={stylesx.socialButtonsContainer}>
          <SocialButton icon="google" label="Google" color="#db4437" />
          <SocialButton icon="facebook" label="Facebook" color="#4267B2" />
        </View>
        {Platform.OS === 'ios' && <SocialButton icon="apple" label="Apple" color="#151515" />}
      </KeyboardAvoidingView>

      <TermsText onTerms={openTerms} onPrivacy={openPrivacy} />

      {showCreateAccountPrompt && (
        <CreateAccountPrompt
          phoneLabel={`+${callingCode} ${normalizedPhone}`}
          onCancel={() => setShowCreateAccountPrompt(false)}
          onCreate={() => {
            setShowCreateAccountPrompt(false);
            navigation.navigate(namer.navigation.signup, { phone: fullPhoneNumber});
          }}
        />
      )}
    </AuthPage>
  );

  const renderVerificationPage = () => {
    const maskedNumber = normalizedPhone
      ? `+${callingCode} *** *** ${normalizedPhone.substring(Math.max(normalizedPhone.length - 4, 0))}`
      : '';

    return (
      <AuthPage fadeAnim={fadeAnim} slideAnim={slideAnim}>
        <TouchableOpacity style={stylesx.backButton} onPress={editPhoneNumber}>
          <MaterialCommunityIcons name="chevron-left" size={24} color="#2d2430" />
        </TouchableOpacity>

        <View style={stylesx.verifyIcon}>
          <MaterialCommunityIcons name="message-text-lock-outline" size={38} color="#e8546f" />
        </View>

        <View style={stylesx.header}>
          <Text style={stylesx.title}>Enter your code</Text>
          <Text style={stylesx.subtitle}>We sent a 6-digit code to {maskedNumber}</Text>
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
                placeholderTextColor="#d1c3ca"
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
}: {
  children: React.ReactNode;
  fadeAnim: Animated.Value;
  slideAnim: Animated.Value;
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

const PrimaryButton = ({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) => (
  <TouchableOpacity
    style={[stylesx.primaryButton, disabled && stylesx.primaryButtonDisabled]}
    disabled={disabled}
    onPress={onPress}>
    <Text style={stylesx.primaryButtonText}>{label}</Text>
  </TouchableOpacity>
);

const SocialButton = ({ icon, label, color }: { icon: string; label: string; color: string }) => (
  <Pressable style={[stylesx.socialButton, { backgroundColor: color }]} onPress={() => {}}>
    <MaterialCommunityIcons name={icon} size={20} color="#ffffff" />
    <Text style={stylesx.socialButtonText}>{label}</Text>
  </Pressable>
);

const TermsText = ({ onTerms, onPrivacy }: { onTerms: () => void; onPrivacy: () => void }) => (
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
}: {
  phoneLabel: string;
  onCancel: () => void;
  onCreate: () => void;
}) => (
  <View style={stylesx.promptBackdrop}>
    <View style={stylesx.promptCard}>
      <View style={stylesx.promptIcon}>
        <MaterialCommunityIcons name="account-plus-outline" size={28} color="#e8546f" />
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

const stylesx = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff8fa',
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
    backgroundColor: '#e8546f',
    shadowColor: '#e8546f',
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
    backgroundColor: '#ffffff',
    shadowColor: '#2b1020',
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
    backgroundColor: '#ffffff',
    shadowColor: '#2b1020',
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
    color: '#2d2430',
    fontSize: 34,
    lineHeight: 39,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    color: '#74636b',
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center',
    maxWidth: 330,
  },
  formCard: {
    width: '100%',
    borderRadius: 20,
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 30,
    gap: 14,
    shadowColor: '#2b1020',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 22,
    elevation: 5,
  },
  fieldLabel: {
    color: '#2d2430',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  phoneInput: {
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: '#fbf5f7',
    borderWidth: 1,
    borderColor: '#efdbe2',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  phoneInputActive: {
    borderColor: '#e8546f',
    backgroundColor: '#fff1f5',
  },
  countryPickerButton: {
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#e8d6dd',
    marginHorizontal: 10,
  },
  input: {
    flex: 1,
    minHeight: 45,
    color: '#2d2430',
    fontSize: 16,
    fontWeight: '700',
  },
  helperText: {
    color: '#8c7882',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  primaryButton: {
    width: '100%',
    minHeight: 45,
    borderRadius: 18,
    backgroundColor: '#e8546f',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#e8546f',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 5,
  },
  primaryButtonDisabled: {
    backgroundColor: '#d8c9cf',
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryButtonText: {
    color: '#ffffff',
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
    backgroundColor: '#efdbe2',
  },
  dividerText: {
    color: '#9b8790',
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
    color: '#ffffff',
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
    color: '#9b8790',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  termsLink: {
    color: '#e8546f',
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
    borderColor: '#efdbe2',
    borderRadius: 14,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '900',
    backgroundColor: '#fbf5f7',
    color: '#2d2430',
  },
  codeInputActive: {
    borderColor: '#e8546f',
    backgroundColor: '#fff1f5',
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
    backgroundColor: '#fff1f5',
    borderWidth: 1,
    borderColor: '#f2c9d4',
  },
  resendButtonDisabled: {
    opacity: 0.55,
  },
  resendButtonText: {
    color: '#e8546f',
    fontSize: 13,
    fontWeight: '900',
  },
  promptBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(45, 36, 48, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  promptCard: {
    width: '100%',
    borderRadius: 22,
    backgroundColor: '#ffffff',
    padding: 20,
    shadowColor: '#2b1020',
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
    backgroundColor: '#fff1f5',
    marginBottom: 14,
  },
  promptTitle: {
    color: '#2d2430',
    fontSize: 22,
    fontWeight: '900',
  },
  promptText: {
    marginTop: 9,
    color: '#74636b',
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
    borderColor: '#efdbe2',
    backgroundColor: '#fbf5f7',
  },
  promptButtonPrimary: {
    backgroundColor: '#e8546f',
  },
  promptButtonCancelText: {
    color: '#5c4c54',
    fontSize: 14,
    fontWeight: '900',
  },
  promptButtonPrimaryText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
});
