import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import { launchImageLibrary } from 'react-native-image-picker';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CarouselRef, ControlledCarousel } from '../funcs/customCarousel';
import {
  __init__app,
  cacheStorage,
  getCurrentLocation,
  getFriendlyNetworkErrorMessage,
  navigationRef,
  screenWidth,
  uploadHandler,
} from '../funcs/functions';
import { Toastx } from '../funcs/customNotification';
import { Loaderx } from '../funcs/functions_stateful';
import { namer, __CONFIG__ } from '../funcs/static';
import { sessionManager } from '../funcs/SessionContext';
import { useTheme, ThemeColors } from '../funcs/theme';

type SignupData = {
  phoneNumber: string;
  verificationCode: string;
  phoneVerified: boolean;
  intent: string;
  firstName: string;
  birthday: string;
  gender: string;
  interestedIn: string;
  photos: string[];
  bio: string;
  smoking: string;
  drinking: string;
  children: string;
  hasPet: string;
  // interests: string[];
  locationEnabled: boolean | null;
  location: any | null;
};

type OptionCardProps = {
  label: string;
  value: string;
  selected: boolean;
  onPress: () => void;
  icon?: string;
};

type MapperOption = {
  label: string;
  value: string;
};

type SignupPhotoUpload = {
  status: 'uploading' | 'uploaded' | 'failed';
  uploadedPath?: string;
  error?: string;
};

const mapLabelsToOptions = (labels: string[]): MapperOption[] =>
  labels.map(label => ({ label, value: label }));

const fallbackOptions = {
  intent: mapLabelsToOptions([
    'Long-term relationship',
    'Casual dating',
    'New friends',
    'Still figuring it out',
  ]),
  gender: mapLabelsToOptions(['Woman', 'Man', 'Non-binary']),
  interestedIn: mapLabelsToOptions([
    'Women',
    'Men',
    'Everyone',
    'Non-binary people',
  ]),
  smoking: [
    { label: 'No', value: '0' },
    { label: 'Yes', value: '1' },
    { label: 'Sometimes', value: '2' },
  ],
  drinking: [
    { label: 'No', value: '0' },
    { label: 'Yes', value: '1' },
    { label: 'Occasionally', value: '2' },
  ],
  children: [
    { label: 'No', value: '0' },
    { label: 'Yes', value: '1' },
  ],
  hasPet: [
    { label: 'No', value: '0' },
    { label: 'Yes', value: '1' },
  ],
  // interests: mapLabelsToOptions([
  //   'Music',
  //   'Gym',
  //   'Travel',
  //   'Gaming',
  //   'Food',
  //   'Movies',
  //   'Fashion',
  //   'Books',
  //   'Anime',
  //   'Startups',
  // ]),
};

const promptExamples = [
  'My perfect weekend is...',
  'Green flags I love...',
  "I'll fall for you if...",
];

const getFileExtension = (path: string) => {
  const cleanPath = path.split('?')[0].split('#')[0];
  const ext = cleanPath
    .split('.')
    .pop()
    ?.toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  return ext || 'jpg';
};

const getMimeTypeFromExt = (ext: string) => {
  switch (ext.toLowerCase()) {
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'bmp':
      return 'image/bmp';
    case 'jpg':
    case 'jpeg':
    default:
      return 'image/jpeg';
  }
};

const mapperToOptions = (
  mapper: any,
  keys: string[],
  fallback: MapperOption[],
) => {
  const mapperGroup = keys.map(key => mapper?.[key]).find(Boolean);
  if (!mapperGroup) return fallback;

  if (Array.isArray(mapperGroup)) {
    const options = mapperGroup
      .map((item: any) => ({
        label: String(
          item?.label ?? item?.map_label ?? item?.interested_in ?? item ?? '',
        ).trim(),
        value: String(
          item?.value ??
            item?.code ??
            item?.map_code ??
            item?.id_ai ??
            item ??
            '',
        ).trim(),
      }))
      .filter((item: MapperOption) => item.label && item.value);

    return options.length > 0 ? options : fallback;
  }

  if (typeof mapperGroup === 'object') {
    const options = Object.entries(mapperGroup).map(([value, label]) => ({
      value: String(value),
      label: String(label),
    }));

    return options.length > 0 ? options : fallback;
  }

  return fallback;
};

export const Auth_Signup = ({ route }: { route: any }) => {
  const { colors } = useTheme();
  const stylesx = useMemo(() => createStylesx(colors), [colors]);
  const initialSignupData: SignupData = {
    phoneNumber: route.params?.phone ?? '',
    verificationCode: '',
    phoneVerified: false,
    intent: '',
    firstName: '',
    birthday: '',
    gender: '',
    interestedIn: '',
    photos: [],
    bio: '',
    smoking: '',
    drinking: '',
    children: '',
    hasPet: '',
    // interests: [],
    locationEnabled: null,
    location: null,
  };

  const carouselRef = useRef<CarouselRef>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [step, setStep] = useState(0);
  const [signupData, setSignupData] = useState<SignupData>(initialSignupData);
  const [getMapper, setMapperOptions] = useState(fallbackOptions);
  const [verificationSent, setVerificationSent] = useState(false);
  const [verificationSendCount, setVerificationSendCount] = useState(0);
  const [resendCooldownSeconds, setResendCooldownSeconds] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoUploads, setPhotoUploads] = useState<
    Record<string, SignupPhotoUpload>
  >({});
  const photoUploadPromises = useRef<Record<string, Promise<string>>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const setFieldError = (field: string, message: string) => {
    setFieldErrors(prev => ({ ...prev, [field]: message }));
  };

  const clearFieldError = (field: string) => {
    setFieldErrors(prev => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const steps = useMemo(
    () => [
      { eyebrow: 'Intent', title: 'Start with the good stuff' },
      { eyebrow: 'Basics', title: 'Tell us about you' },
      { eyebrow: 'Photos', title: 'Add your best shots' },
      { eyebrow: 'Bio', title: 'Add a spark' },
      // { eyebrow: 'Interests', title: 'Pick your favorites' },
      { eyebrow: 'Lifestyle', title: 'A few lifestyle basics' },
      { eyebrow: 'Nearby', title: 'Find people nearby.' },
      { eyebrow: 'Phone', title: 'Verify your number' },
    ],
    [],
  );

  const updateSignupData = <K extends keyof SignupData>(
    field: K,
    value: SignupData[K],
  ) => {
    setSignupData(prev => ({ ...prev, [field]: value }));
    clearFieldError(field as string);
  };

  useEffect(() => {
    let mounted = true;

    cacheStorage
      .getMapper(false, [
        'intent',
        'gender',
        'interested_in',
        'smoking',
        'drinking',
        'children',
        'pets',
      ])
      .then(mapper => {
        if (!mounted || !mapper) return;

        setMapperOptions({
          intent: mapperToOptions(
            mapper,
            ['bio_intent', 'intent'],
            fallbackOptions.intent,
          ),
          gender: mapperToOptions(
            mapper,
            ['bio_gender', 'gender'],
            fallbackOptions.gender,
          ),
          interestedIn: mapperToOptions(
            mapper,
            ['interested_in', 'interestedIn'],
            fallbackOptions.interestedIn,
          ),
          smoking: mapperToOptions(
            mapper,
            ['bio_smoking', 'smoking'],
            fallbackOptions.smoking,
          ),
          drinking: mapperToOptions(
            mapper,
            ['bio_drinking', 'drinking'],
            fallbackOptions.drinking,
          ),
          children: mapperToOptions(
            mapper,
            ['bio_children', 'children'],
            fallbackOptions.children,
          ),
          hasPet: mapperToOptions(
            mapper,
            ['bio_pets', 'pets'],
            fallbackOptions.hasPet,
          ),
          // interests: mapperToOptions(mapper, ['interests', 'interest'], fallbackOptions.interests),
        });
      })
      .catch(error => {
        console.error('Error loading signup mapper:', error);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (resendCooldownSeconds <= 0) return;

    const timer = setInterval(() => {
      setResendCooldownSeconds(seconds => Math.max(seconds - 1, 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [resendCooldownSeconds]);

  const animatePageChange = (nextStep: number) => {
    setStep(nextStep);
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
  };

  const birthdayIsValid = () => {
    const normalized = signupData.birthday.trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
    if (!match) return false;

    const birthDate = new Date(`${normalized}T00:00:00`);
    if (Number.isNaN(birthDate.getTime())) return false;

    const today = new Date();
    const minAgeDate = new Date(today);
    minAgeDate.setFullYear(today.getFullYear() - 18);
    const maxAgeDate = new Date(today);
    maxAgeDate.setFullYear(today.getFullYear() - 120);

    const [, year, month, day] = match;
    return (
      birthDate.getFullYear() === Number(year) &&
      birthDate.getMonth() + 1 === Number(month) &&
      birthDate.getDate() === Number(day) &&
      birthDate <= minAgeDate &&
      birthDate >= maxAgeDate
    );
  };

  const validateStep = () => {
    if (step === 0) {
      if (!signupData.intent) {
        setFieldError('intent', 'Choose what you are looking for.');
        return false;
      }
      clearFieldError('intent');
    }

    if (step === 1) {
      let valid = true;
      if (signupData.firstName.trim().length < 2) {
        setFieldError('firstName', 'Enter your first name.');
        valid = false;
      } else {
        clearFieldError('firstName');
      }

      if (!birthdayIsValid()) {
        setFieldError('birthday', 'Enter a valid birthday. You must be 18+.');
        valid = false;
      } else {
        clearFieldError('birthday');
      }

      if (!signupData.gender) {
        setFieldError('gender', 'Select your gender.');
        valid = false;
      } else {
        clearFieldError('gender');
      }

      if (!signupData.interestedIn) {
        setFieldError('interestedIn', 'Select who you want to meet.');
        valid = false;
      } else {
        clearFieldError('interestedIn');
      }

      if (!valid) return false;
    }

    if (step === 2) {
      if (signupData.photos.length < 2) {
        setFieldError('photos', 'Add at least two photos.');
        return false;
      }
      clearFieldError('photos');
    }

    // if (step === 4 && signupData.interests.length < 3) {
    //   setFieldError('interests', 'Pick at least 3 interests.');
    //   return false;
    // }
    // Keep required checks local to the active step so the flow stays low-friction.
    if (step === 6 && !signupData.phoneVerified) {
      setFieldError('phoneVerified', 'Verify your phone number to continue.');
      return false;
    }
    return true;
  };

  const goNext = () => {
    if (!validateStep()) return;
    const nextStep = Math.min(step + 1, steps.length - 1);
    carouselRef.current?.goToPage(nextStep);
    animatePageChange(nextStep);
  };

  const goBack = () => {
    const previousStep = Math.max(step - 1, 0);
    carouselRef.current?.goToPage(previousStep);
    animatePageChange(previousStep);
  };

  const addPhoto = async () => {
    if (signupData.photos.length >= 6) {
      Toastx.show({ type: 'info', message: 'You can add up to 6 photos.' });
      return;
    }

    const result = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 6 - signupData.photos.length,
      quality: 0.9,
    });

    if (result.didCancel) return;
    if (result.errorMessage) {
      setFieldError('photos', result.errorMessage);
      return;
    }

    const selectedUris = (result.assets ?? [])
      .map(asset => asset.uri)
      .filter((uri): uri is string => Boolean(uri));

    if (selectedUris.length > 0) {
      const nextPhotos = [...signupData.photos, ...selectedUris].slice(0, 6);
      updateSignupData('photos', nextPhotos);
      selectedUris.forEach((uri, selectedIndex) => {
        uploadSignupPhoto(uri, signupData.photos.length + selectedIndex).catch(
          () => {
            setFieldError(
              'photos',
              'A signup photo failed to upload. We will retry before signup.',
            );
          },
        );
      });
    }
  };

  const removePhoto = (index: number) => {
    updateSignupData(
      'photos',
      signupData.photos.filter((_, photoIndex) => photoIndex !== index),
    );
  };

  const movePhoto = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= signupData.photos.length) return;

    const nextPhotos = [...signupData.photos];
    const [photo] = nextPhotos.splice(index, 1);
    nextPhotos.splice(targetIndex, 0, photo);
    updateSignupData('photos', nextPhotos);
  };

  // const toggleInterest = (interest: string) => {
  //   const exists = signupData.interests.includes(interest);
  //   const nextInterests = exists
  //     ? signupData.interests.filter(item => item !== interest)
  //     : [...signupData.interests, interest];
  //   updateSignupData('interests', nextInterests);
  // };

  const formatBirthday = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 4) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
  };

  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  const uploadSignupPhoto = async (uri: string, index: number) => {
    if (await photoUploadPromises.current[uri])
      return photoUploadPromises.current[uri];

    const uploadPromise = (async () => {
      setPhotoUploads(prev => ({
        ...prev,
        [uri]: { status: 'uploading' },
      }));

      try {
        const ext = getFileExtension(uri);
        const contentType = getMimeTypeFromExt(ext);
        const presigned = await uploadHandler.requestPresignedURL_Upload(
          ext,
          'signup-void',
        );
        const uploadFilePath = uri.startsWith('file://')
          ? uri.replace('file://', '')
          : uri;

        const uploadResult = await RNFS.uploadFiles({
          toUrl: presigned.uploadUrl,
          files: [
            {
              name: 'file',
              filename: `signup_${Date.now()}_${index}.${ext}`,
              filepath: uploadFilePath,
              filetype: contentType,
            },
          ],
          method: presigned.method || 'PUT',
          headers: {
            'Content-Type': contentType,
          },
          binaryStreamOnly: true,
        }).promise;

        if (uploadResult.statusCode < 200 || uploadResult.statusCode >= 300) {
          throw new Error('Photo upload failed.');
        }

        const uploadedPath =
          '/' + uploadHandler.joinPath(presigned.bucket, presigned.fileKey);
        setPhotoUploads(prev => ({
          ...prev,
          [uri]: {
            status: 'uploaded',
            uploadedPath,
          },
        }));
        return uploadedPath;
      } catch (error: any) {
        delete photoUploadPromises.current[uri];
        setPhotoUploads(prev => ({
          ...prev,
          [uri]: {
            status: 'failed',
            error: error?.message ?? 'Photo upload failed.',
          },
        }));
        throw error;
      }
    })();

    photoUploadPromises.current[uri] = uploadPromise;
    return uploadPromise;
  };

  const ensureSignupPhotoUploads = async () => {
    const uploadedPhotos = await Promise.all(
      signupData.photos.map((photoUri, index) => {
        const uploadedPath = photoUploads[photoUri]?.uploadedPath;
        return uploadedPath
          ? Promise.resolve(uploadedPath)
          : uploadSignupPhoto(photoUri, index);
      }),
    );

    return uploadedPhotos;
  };

  const getSignupPhoneNumber = () => {
    const digits = signupData.phoneNumber.replace(/\D/g, '');
    return digits.length === 11 && digits.startsWith('1')
      ? digits.slice(1)
      : digits;
  };

  const formatCooldown = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const buildLocationPayload = (position: any) => ({
    latd: position?.coords?.latitude,
    long: position?.coords?.longitude,
    accuracy: position?.coords?.accuracy,
    altitude: position?.coords?.altitude,
    altitudeAccuracy: position?.coords?.altitudeAccuracy,
    heading: position?.coords?.heading,
    speed: position?.coords?.speed,
    timestamp: position?.timestamp,
  });

  const signupPayload = (vcode?: string, photos?: string[]) => ({
    user_phone: getSignupPhoneNumber(),
    vcode,
    first_name: signupData.firstName,
    birthday: signupData.birthday,
    gender: signupData.gender,
    interested_in: signupData.interestedIn,
    intent: signupData.intent,
    photos: photos ?? signupData.photos,
    bio: signupData.bio,
    smoking: signupData.smoking,
    drinking: signupData.drinking,
    children: signupData.children,
    haspet: signupData.hasPet,
    // interests: signupData.interests,
    location: signupData.location,
  });

  const sendVerificationCode = async () => {
    if (resendCooldownSeconds > 0 || isSubmitting) return;

    if (getSignupPhoneNumber().length !== 10) {
      setFieldError('phoneNumber', 'Enter a valid phone number.');
      return;
    }
    clearFieldError('phoneNumber');

    setIsSubmitting(true);
    try {
      const response = await fetch(
        `${__CONFIG__.HTTPS_API_DOMAIN}/api/signup`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(signupPayload()),
        },
      );
      const result = await response.json();

      if (result?.code !== 200) {
        setFieldError(
          'phoneNumber',
          result?.message ?? 'Could not send verification code.',
        );
        return;
      }

      const nextSendCount = verificationSendCount + 1;
      setVerificationSendCount(nextSendCount);
      setResendCooldownSeconds(60 * nextSendCount);
      setVerificationSent(true);
      if (result?.dev_code)
        updateSignupData('verificationCode', String(result.dev_code));
      updateSignupData('phoneVerified', false);
      Toastx.show({
        type: 'success',
        message: result?.message ?? 'Verification code sent.',
      });
    } catch (error: any) {
      setFieldError(
        'phoneNumber',
        await getFriendlyNetworkErrorMessage(
          error,
          'Could not send verification code.',
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmVerificationCode = async () => {
    if (signupData.verificationCode.replace(/\D/g, '').length !== 6) {
      setFieldError('verificationCode', 'Enter the 6-digit code.');
      return false;
    }
    clearFieldError('verificationCode');

    if (isSubmitting) return false;

    setIsSubmitting(true);
    Loaderx.show();
    try {
      const uploadedPhotos = await ensureSignupPhotoUploads();
      const response = await fetch(
        `${__CONFIG__.HTTPS_API_DOMAIN}/api/signup`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            signupPayload(signupData.verificationCode, uploadedPhotos),
          ),
        },
      );
      const result = await response.json();

      if (result?.code !== 200) {
        setFieldError('verificationCode', result?.message ?? 'Signup failed.');
        return false;
      }

      const auth = response.headers.get('x-omi-auth') ?? '';
      if (!auth) {
        Toastx.show({
          type: 'error',
          message: 'Signup succeeded, but login session was not returned.',
        });
        return false;
      }
      await AsyncStorage.setItem(namer.storage.sessionId, auth);
      await sessionManager.updateSession({
        x_omi_payload: auth,
      });
      await Promise.all([
        __init__app(),
        cacheStorage.getCurrentUserProfile(true),
        cacheStorage.getProducts(true),
      ]);

      updateSignupData('phoneVerified', true);
      Toastx.show({ type: 'success', message: 'Signup complete.' });
      navigationRef.reset({
        index: 0,
        routes: [{ name: namer.navigation.home }],
      });
      return true;
    } catch (error: any) {
      Toastx.show({
        type: 'error',
        message: await getFriendlyNetworkErrorMessage(error, 'Signup failed.'),
      });
      return false;
    } finally {
      Loaderx.hide();
      setIsSubmitting(false);
    }
  };

  const renderStepShell = (children: React.ReactNode) => (
    <Animated.View
      style={[
        stylesx.page,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );

  const renderIntentScreen = () =>
    renderStepShell(
      <StepScroll stylesx={stylesx}>
        <StepHeader
          eyebrow="Intent"
          title="What are you looking for?"
          stylesx={stylesx}
        />
        <View style={stylesx.optionStack}>
          {getMapper.intent.map((intent, index) => (
            <OptionCard
              key={intent.value}
              label={intent.label}
              value={intent.value}
              icon={
                [
                  'heart-outline',
                  'glass-cocktail',
                  'account-group-outline',
                  'compass-outline',
                ][index]
              }
              selected={signupData.intent === intent.value}
              onPress={() => updateSignupData('intent', intent.value)}
              colors={colors}
              stylesx={stylesx}
            />
          ))}
        </View>
        <FieldError message={fieldErrors.intent} stylesx={stylesx} />
      </StepScroll>,
    );

  const renderBasicsScreen = () =>
    renderStepShell(
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <StepScroll stylesx={stylesx}>
          <StepHeader
            eyebrow="Basics"
            title="Tell us about you"
            helper="Keep it simple. You can edit these later."
            stylesx={stylesx}
          />
          <View style={stylesx.card}>
            <FieldLabel label="First name" stylesx={stylesx} />
            <TextInput
              style={[
                stylesx.input,
                fieldErrors.firstName && stylesx.inputError,
              ]}
              placeholder="Alex"
              placeholderTextColor={colors.placeholder}
              value={signupData.firstName}
              onChangeText={value => updateSignupData('firstName', value)}
              maxLength={28}
              autoCapitalize="words"
            />
            <FieldError message={fieldErrors.firstName} stylesx={stylesx} />

            <FieldLabel
              label="Birthday"
              helper="YYYY-MM-DD"
              stylesx={stylesx}
            />
            <TextInput
              style={[
                stylesx.input,
                fieldErrors.birthday && stylesx.inputError,
              ]}
              placeholder="1998-04-22"
              placeholderTextColor={colors.placeholder}
              value={signupData.birthday}
              onChangeText={value =>
                updateSignupData('birthday', formatBirthday(value))
              }
              keyboardType="number-pad"
              maxLength={10}
            />
            <FieldError message={fieldErrors.birthday} stylesx={stylesx} />

            <FieldLabel label="Gender" stylesx={stylesx} />
            <View style={stylesx.chipWrap}>
              {getMapper.gender.map(gender => (
                <Chip
                  key={gender.value}
                  label={gender.label}
                  selected={signupData.gender === gender.value}
                  onPress={() => updateSignupData('gender', gender.value)}
                  stylesx={stylesx}
                />
              ))}
            </View>
            <FieldError message={fieldErrors.gender} stylesx={stylesx} />

            <FieldLabel label="Interested in" stylesx={stylesx} />
            <View style={stylesx.chipWrap}>
              {getMapper.interestedIn.map(option => (
                <Chip
                  key={option.value}
                  label={option.label}
                  selected={signupData.interestedIn === option.value}
                  onPress={() => updateSignupData('interestedIn', option.value)}
                  stylesx={stylesx}
                />
              ))}
            </View>
            <FieldError message={fieldErrors.interestedIn} stylesx={stylesx} />
          </View>
        </StepScroll>
      </KeyboardAvoidingView>,
    );

  const renderPhotosScreen = () =>
    renderStepShell(
      <StepScroll stylesx={stylesx}>
        <StepHeader
          eyebrow="Photos"
          title="Add up to 6 photos"
          helper="At least two photos are required."
          stylesx={stylesx}
        />
        <View style={stylesx.photoGrid}>
          {Array.from({ length: 6 }).map((_, index) => {
            const photoUri = signupData.photos[index];
            return (
              <TouchableOpacity
                key={index}
                style={[
                  stylesx.photoSlot,
                  index === 0 && stylesx.primaryPhotoSlot,
                ]}
                activeOpacity={0.85}
                onPress={photoUri ? undefined : addPhoto}
              >
                {photoUri ? (
                  <>
                    <Image
                      source={{ uri: photoUri }}
                      style={stylesx.photoImage}
                    />
                    <View style={stylesx.photoOverlay}>
                      <TouchableOpacity
                        style={stylesx.photoIconButton}
                        onPress={() => movePhoto(index, -1)}
                      >
                        <MaterialCommunityIcons
                          name="arrow-left"
                          size={16}
                          color="#ffffff"
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={stylesx.photoIconButton}
                        onPress={() => removePhoto(index)}
                      >
                        <MaterialCommunityIcons
                          name="trash-can-outline"
                          size={16}
                          color="#ffffff"
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={stylesx.photoIconButton}
                        onPress={() => movePhoto(index, 1)}
                      >
                        <MaterialCommunityIcons
                          name="arrow-right"
                          size={16}
                          color="#ffffff"
                        />
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <View style={stylesx.emptyPhoto}>
                    <MaterialCommunityIcons
                      name="plus"
                      size={26}
                      color={colors.primary}
                    />
                    <Text style={stylesx.emptyPhotoText}>
                      {index === 0 ? 'Main photo' : 'Add photo'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity style={stylesx.secondaryButton} onPress={addPhoto}>
          <MaterialCommunityIcons
            name="image-plus"
            size={20}
            color={colors.primary}
          />
          <Text style={stylesx.secondaryButtonText}>Upload Photos</Text>
        </TouchableOpacity>
        <FieldError message={fieldErrors.photos} stylesx={stylesx} />
      </StepScroll>,
    );

  const renderBioScreen = () =>
    renderStepShell(
      <StepScroll stylesx={stylesx}>
        <StepHeader
          eyebrow="Bio"
          title="Write a short bio"
          helper="A few specific details beat a long resume."
          stylesx={stylesx}
        />
        <View style={stylesx.card}>
          <TextInput
            style={[stylesx.input, stylesx.bioInput]}
            placeholder="A tiny intro that makes someone want to say hi..."
            placeholderTextColor={colors.placeholder}
            value={signupData.bio}
            onChangeText={value => updateSignupData('bio', value.slice(0, 240))}
            multiline
            textAlignVertical="top"
          />
          <Text style={stylesx.characterCount}>
            {signupData.bio.length}/240
          </Text>
        </View>
        <View style={stylesx.promptCard}>
          {promptExamples.map(prompt => (
            <TouchableOpacity
              key={prompt}
              style={stylesx.promptPill}
              onPress={() =>
                updateSignupData(
                  'bio',
                  signupData.bio
                    ? `${signupData.bio}\n${prompt} `
                    : `${prompt} `,
                )
              }
            >
              <Text style={stylesx.promptText}>{prompt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </StepScroll>,
    );

  const renderLifestyleScreen = () =>
    renderStepShell(
      <StepScroll stylesx={stylesx}>
        <StepHeader
          eyebrow="Lifestyle"
          title="A few lifestyle basics"
          helper="Helps us find better matches. You can change these later."
          stylesx={stylesx}
        />
        <View style={stylesx.card}>
          <FieldLabel label="Smoking" stylesx={stylesx} />
          <View style={stylesx.chipWrap}>
            {getMapper.smoking.map(option => (
              <Chip
                key={option.value}
                label={option.label}
                selected={signupData.smoking === option.value}
                onPress={() => updateSignupData('smoking', option.value)}
                stylesx={stylesx}
              />
            ))}
          </View>

          <FieldLabel label="Drinking" stylesx={stylesx} />
          <View style={stylesx.chipWrap}>
            {getMapper.drinking.map(option => (
              <Chip
                key={option.value}
                label={option.label}
                selected={signupData.drinking === option.value}
                onPress={() => updateSignupData('drinking', option.value)}
                stylesx={stylesx}
              />
            ))}
          </View>

          <FieldLabel label="Have kids" stylesx={stylesx} />
          <View style={stylesx.chipWrap}>
            {getMapper.children.map(option => (
              <Chip
                key={option.value}
                label={option.label}
                selected={signupData.children === option.value}
                onPress={() => updateSignupData('children', option.value)}
                stylesx={stylesx}
              />
            ))}
          </View>

          <FieldLabel label="Have a pet" stylesx={stylesx} />
          <View style={stylesx.chipWrap}>
            {getMapper.hasPet.map(option => (
              <Chip
                key={option.value}
                label={option.label}
                selected={signupData.hasPet === option.value}
                onPress={() => updateSignupData('hasPet', option.value)}
                stylesx={stylesx}
              />
            ))}
          </View>
        </View>
      </StepScroll>,
    );

  // const renderInterestsScreen = () =>
  //   renderStepShell(
  //     <StepScroll stylesx={stylesx}>
  //       <StepHeader eyebrow="Interests" title="Choose at least 3" helper={`${signupData.interests.length}/3 selected`} stylesx={stylesx} />
  //       <View style={stylesx.card}>
  //         <View style={stylesx.chipWrap}>
  //           {getMapper.interests.map(interest => (
  //             <Chip
  //               key={interest.value}
  //               label={interest.label}
  //               selected={signupData.interests.includes(interest.value)}
  //               onPress={() => toggleInterest(interest.value)}
  //             />
  //           ))}
  //         </View>
  //       </View>
  //     </StepScroll>,
  //   );

  const renderLocationScreen = () =>
    renderStepShell(
      <View style={stylesx.centerPage}>
        <View style={stylesx.locationIcon}>
          <MaterialCommunityIcons
            name="map-marker-radius-outline"
            size={52}
            color={colors.primary}
          />
        </View>
        <Text style={stylesx.heroTitle}>Find people nearby.</Text>
        <Text style={stylesx.heroCopy}>
          We use your location to show better matches.
        </Text>
        <TouchableOpacity
          style={stylesx.primaryButton}
          onPress={async () => {
            if (isSubmitting) return;
            setIsSubmitting(true);
            Loaderx.show();
            try {
              const location = await getCurrentLocation();
              updateSignupData('location', buildLocationPayload(location));
              updateSignupData('locationEnabled', true);
              goNext();
            } catch {
              Toastx.show({
                type: 'error',
                message: 'Unable to get current location.',
              });
            } finally {
              Loaderx.hide();
              setIsSubmitting(false);
            }
          }}
        >
          <Text style={stylesx.primaryButtonText}>Enable Location</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={stylesx.textButton}
          onPress={() => {
            updateSignupData('locationEnabled', false);
            goNext();
          }}
        >
          <Text style={stylesx.textButtonText}>Not Now</Text>
        </TouchableOpacity>
      </View>,
    );

  const verifyPhonenumber = () =>
    renderStepShell(
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <StepScroll stylesx={stylesx}>
          <StepHeader
            eyebrow="Phone"
            title="Verify your number"
            helper="We'll use this to keep accounts real."
            stylesx={stylesx}
          />
          <View style={stylesx.card}>
            <FieldLabel label="Phone number" stylesx={stylesx} />
            <TextInput
              style={[
                stylesx.input,
                fieldErrors.phoneNumber && stylesx.inputError,
              ]}
              placeholder="(555) 123-4567"
              placeholderTextColor={colors.placeholder}
              value={signupData.phoneNumber}
              onChangeText={value => {
                updateSignupData('phoneNumber', formatPhoneNumber(value));
                updateSignupData('phoneVerified', false);
                setVerificationSent(false);
                setVerificationSendCount(0);
                setResendCooldownSeconds(0);
              }}
              keyboardType="phone-pad"
              maxLength={14}
            />
            <FieldError message={fieldErrors.phoneNumber} stylesx={stylesx} />
            <TouchableOpacity
              style={[
                stylesx.secondaryButton,
                resendCooldownSeconds > 0 && stylesx.secondaryButtonDisabled,
              ]}
              onPress={sendVerificationCode}
              disabled={resendCooldownSeconds > 0}
            >
              <MaterialCommunityIcons
                name="message-processing-outline"
                size={20}
                color={colors.primary}
              />
              <Text style={stylesx.secondaryButtonText}>
                {resendCooldownSeconds > 0
                  ? `Resend in ${formatCooldown(resendCooldownSeconds)}`
                  : verificationSent
                  ? 'Resend Code'
                  : 'Send Code'}
              </Text>
            </TouchableOpacity>

            {verificationSent && (
              <>
                <FieldLabel
                  label="Verification code"
                  helper="6 digits"
                  stylesx={stylesx}
                />
                <TextInput
                  style={[
                    stylesx.input,
                    { letterSpacing: 5 },
                    fieldErrors.verificationCode && stylesx.inputError,
                  ]}
                  placeholder="123456"
                  placeholderTextColor={colors.placeholder}
                  value={signupData.verificationCode}
                  onChangeText={value => {
                    updateSignupData(
                      'verificationCode',
                      value.replace(/\D/g, '').slice(0, 6),
                    );
                    updateSignupData('phoneVerified', false);
                  }}
                  keyboardType="number-pad"
                  maxLength={6}
                />
                <FieldError
                  message={fieldErrors.verificationCode}
                  stylesx={stylesx}
                />
                <TouchableOpacity
                  style={stylesx.secondaryButton}
                  onPress={confirmVerificationCode}
                  disabled={isSubmitting}
                >
                  <MaterialCommunityIcons
                    name="check-circle-outline"
                    size={20}
                    color={colors.primary}
                  />
                  <Text style={stylesx.secondaryButtonText}>
                    {signupData.phoneVerified ? 'Verified' : 'Verify Code'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
            <FieldError message={fieldErrors.phoneVerified} stylesx={stylesx} />
          </View>
        </StepScroll>
      </KeyboardAvoidingView>,
    );

  const pages = [
    renderIntentScreen(),
    renderBasicsScreen(),
    renderPhotosScreen(),
    renderBioScreen(),
    // renderInterestsScreen(),
    renderLifestyleScreen(),
    renderLocationScreen(),
    verifyPhonenumber(),
  ];

  return (
    <SafeAreaView style={stylesx.container} edges={['top', 'bottom']}>
      <View style={stylesx.topBar}>
        <TouchableOpacity
          style={stylesx.backButton}
          onPress={
            step !== 0
              ? goBack
              : () => {
                  navigationRef.goBack();
                }
          }
        >
          <MaterialCommunityIcons
            name="chevron-left"
            size={26}
            color={colors.text}
          />
        </TouchableOpacity>
        <View style={stylesx.progressWrap}>
          <Text style={stylesx.progressText}>
            {steps[step].eyebrow} {step + 1}/{steps.length}
          </Text>
          <View style={stylesx.progressTrack}>
            <View
              style={[
                stylesx.progressFill,
                { width: `${((step + 1) / steps.length) * 100}%` },
              ]}
            />
          </View>
        </View>
      </View>

      <ControlledCarousel
        ref={carouselRef}
        pages={pages}
        onPageChange={index => animatePageChange(index)}
      />

      {step !== 6 && (
        <View style={stylesx.footer}>
          <TouchableOpacity style={stylesx.primaryButton} onPress={goNext}>
            <Text style={stylesx.primaryButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const OptionCard = ({
  label,
  selected,
  onPress,
  icon = 'heart-outline',
  colors,
  stylesx,
}: OptionCardProps & { colors: ThemeColors; stylesx: any }) => (
  <TouchableOpacity
    style={[stylesx.optionCard, selected && stylesx.optionCardSelected]}
    onPress={onPress}
  >
    <View style={[stylesx.optionIcon, selected && stylesx.optionIconSelected]}>
      <MaterialCommunityIcons
        name={icon}
        size={22}
        color={selected ? '#ffffff' : colors.primary}
      />
    </View>
    <Text
      style={[
        stylesx.optionText,
        selected && stylesx.optionTextSelected,
        { textTransform: 'capitalize' },
      ]}
    >
      {label}
    </Text>
    {selected && (
      <MaterialCommunityIcons
        name="check-circle"
        size={22}
        color={colors.primary}
      />
    )}
  </TouchableOpacity>
);

const Chip = ({
  label,
  selected,
  onPress,
  stylesx,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  stylesx: any;
}) => (
  <TouchableOpacity
    style={[stylesx.chip, selected && stylesx.chipSelected]}
    onPress={onPress}
  >
    <Text
      style={[
        stylesx.chipText,
        selected && stylesx.chipTextSelected,
        { textTransform: 'capitalize' },
      ]}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

const StepHeader = ({
  eyebrow,
  title,
  helper,
  stylesx,
}: {
  eyebrow: string;
  title: string;
  helper?: string;
  stylesx: any;
}) => (
  <View style={stylesx.stepHeader}>
    <Text style={stylesx.eyebrow}>{eyebrow}</Text>
    <Text style={stylesx.stepTitle}>{title}</Text>
    {helper && <Text style={stylesx.stepHelper}>{helper}</Text>}
  </View>
);

const FieldLabel = ({
  label,
  helper,
  stylesx,
}: {
  label: string;
  helper?: string;
  stylesx: any;
}) => (
  <View style={stylesx.fieldLabelRow}>
    <Text style={stylesx.fieldLabel}>{label}</Text>
    {helper && <Text style={stylesx.fieldHelper}>{helper}</Text>}
  </View>
);

const FieldError = ({ message, stylesx }: { message?: string; stylesx: any }) =>
  message ? <Text style={stylesx.fieldError}>{message}</Text> : null;

const StepScroll = ({
  children,
  stylesx,
}: {
  children: React.ReactNode;
  stylesx: any;
}) => (
  <ScrollView
    style={{ flex: 1 }}
    showsVerticalScrollIndicator={false}
    keyboardShouldPersistTaps="handled"
    contentContainerStyle={stylesx.scrollContent}
  >
    {children}
  </ScrollView>
);

function createStylesx(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 10,
      gap: 12,
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
    },
    progressWrap: {
      flex: 1,
      gap: 8,
    },
    progressText: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.textSecondary,
      textTransform: 'uppercase',
    },
    progressTrack: {
      height: 7,
      borderRadius: 7,
      overflow: 'hidden',
      backgroundColor: colors.border,
    },
    progressFill: {
      height: '100%',
      borderRadius: 7,
      backgroundColor: colors.primary,
    },
    page: {
      width: screenWidth,
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 18,
      paddingTop: 8,
      paddingBottom: 24,
      gap: 16,
    },
    centerPage: {
      flex: 1,
      paddingHorizontal: 24,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 18,
    },
    brandMark: {
      width: 82,
      height: 82,
      borderRadius: 41,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: 0.25,
      shadowRadius: 20,
      elevation: 8,
    },
    heroTitle: {
      fontSize: 34,
      lineHeight: 40,
      fontWeight: '900',
      color: colors.text,
      textAlign: 'center',
    },
    heroCopy: {
      fontSize: 16,
      lineHeight: 23,
      color: colors.textSecondary,
      textAlign: 'center',
      maxWidth: 330,
    },
    previewCard: {
      width: '100%',
      maxWidth: 310,
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 12,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.12,
      shadowRadius: 24,
      elevation: 6,
    },
    previewPhoto: {
      height: 240,
      borderRadius: 14,
      backgroundColor: colors.primary,
    },
    previewBody: {
      paddingTop: 12,
    },
    previewName: {
      fontSize: 22,
      fontWeight: '900',
      color: colors.text,
    },
    previewMeta: {
      marginTop: 4,
      fontSize: 14,
      color: colors.textSecondary,
    },
    stepHeader: {
      gap: 8,
      marginBottom: 2,
    },
    eyebrow: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    stepTitle: {
      color: colors.text,
      fontSize: 30,
      lineHeight: 36,
      fontWeight: '900',
    },
    stepHelper: {
      color: colors.textSecondary,
      fontSize: 15,
      lineHeight: 21,
    },
    optionStack: {
      gap: 12,
    },
    optionCard: {
      minHeight: 74,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 3,
    },
    optionCardSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.backgroundSecondary,
    },
    optionIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundSecondary,
    },
    optionIconSelected: {
      backgroundColor: colors.primary,
    },
    optionText: {
      flex: 1,
      fontSize: 16,
      color: colors.text,
      fontWeight: '800',
    },
    optionTextSelected: {
      color: colors.primary,
    },
    card: {
      borderRadius: 18,
      backgroundColor: colors.surface,
      padding: 16,
      gap: 12,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.08,
      shadowRadius: 18,
      elevation: 4,
    },
    fieldLabelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 4,
    },
    fieldLabel: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    fieldHelper: {
      color: colors.textTertiary,
      fontSize: 12,
      fontWeight: '700',
    },
    fieldError: {
      color: colors.error,
      fontSize: 12,
      fontWeight: '700',
      marginTop: -6,
    },
    input: {
      minHeight: 52,
      borderRadius: 14,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      color: colors.text,
      fontSize: 16,
      fontWeight: '700',
    },
    inputError: {
      borderColor: colors.error,
    },
    bioInput: {
      minHeight: 150,
      paddingTop: 14,
      lineHeight: 22,
    },
    characterCount: {
      alignSelf: 'flex-end',
      color: colors.textTertiary,
      fontWeight: '700',
    },
    chipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    chip: {
      borderRadius: 999,
      paddingVertical: 10,
      paddingHorizontal: 15,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '800',
    },
    chipTextSelected: {
      color: '#ffffff',
    },
    photoGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    photoSlot: {
      width: '31.3%',
      aspectRatio: 0.78,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.07,
      shadowRadius: 14,
      elevation: 3,
    },
    primaryPhotoSlot: {
      borderColor: colors.primary,
    },
    emptyPhoto: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    emptyPhotoText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '800',
      textAlign: 'center',
    },
    photoImage: {
      width: '100%',
      height: '100%',
    },
    photoOverlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      minHeight: 42,
      paddingHorizontal: 5,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: 'rgba(45, 36, 48, 0.62)',
    },
    photoIconButton: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.18)',
    },
    secondaryButton: {
      height: 52,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    secondaryButtonDisabled: {
      opacity: 0.55,
    },
    secondaryButtonText: {
      color: colors.primary,
      fontSize: 15,
      fontWeight: '900',
    },
    promptCard: {
      gap: 10,
    },
    promptPill: {
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
    },
    promptText: {
      color: colors.text,
      fontWeight: '800',
      fontSize: 15,
    },
    locationIcon: {
      width: 104,
      height: 104,
      borderRadius: 52,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.1,
      shadowRadius: 22,
      elevation: 6,
    },
    completeIcon: {
      width: 92,
      height: 92,
      borderRadius: 46,
      backgroundColor: colors.success,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.success,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.22,
      shadowRadius: 20,
      elevation: 6,
    },
    footer: {
      paddingHorizontal: 18,
      paddingTop: 10,
      paddingBottom: 12,
      backgroundColor: colors.background,
    },
    primaryButton: {
      width: '100%',
      minHeight: 56,
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
    primaryButtonText: {
      color: '#ffffff',
      fontSize: 17,
      fontWeight: '900',
    },
    textButton: {
      paddingVertical: 8,
      paddingHorizontal: 20,
    },
    textButtonText: {
      color: colors.textSecondary,
      fontSize: 15,
      fontWeight: '900',
    },
  });
}
