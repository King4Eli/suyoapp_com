import React, { useEffect, useMemo, useRef, useState } from 'react';
import {Animated,Image,KeyboardAvoidingView,Platform,ScrollView,StyleSheet,Text,TextInput,TouchableOpacity,View,} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import { launchImageLibrary } from 'react-native-image-picker';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CarouselRef, ControlledCarousel } from '../funcs/customCarousel';
import { __init__app, cacheStorage, getCurrentLocation, hostServer, navigationRef, screenWidth, uploadHandler } from '../funcs/functions';
import { Toastx } from '../funcs/customNotification';
import { Loaderx } from '../funcs/functions_stateful';
import { namer } from '../funcs/static';
import { sessionManager } from '../funcs/SessionContext';

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
  gender: mapLabelsToOptions(['Woman', 'Man', 'Non-binary' ]),
  interestedIn: mapLabelsToOptions(['Women', 'Men', 'Everyone', 'Non-binary people']),
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
  const ext = cleanPath.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '');
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

const mapperToOptions = (mapper: any, keys: string[], fallback: MapperOption[]) => {
  const mapperGroup = keys.map(key => mapper?.[key]).find(Boolean);
  if (!mapperGroup) return fallback;

  if (Array.isArray(mapperGroup)) {
    const options = mapperGroup
      .map((item: any) => ({
        label: String(item?.label ?? item?.map_label ?? item?.interested_in ?? item ?? '').trim(),
        value: String(item?.value ?? item?.code ?? item?.map_code ?? item?.id_ai ?? item ?? '').trim(),
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



export const Auth_Signup = ({route}:{route: any}) => {
  const initialSignupData: SignupData = {
  phoneNumber:route.params?.phone ?? '',
  verificationCode: '',
  phoneVerified: false,
  intent: '',
  firstName: '',
  birthday: '',
  gender: '',
  interestedIn: '',
  photos: [],
  bio: '',
  // interests: [],
  locationEnabled: null,
  location: null,
};

 
  const carouselRef = useRef<CarouselRef>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [step, setStep] = useState(0);
  const [signupData, setSignupData] = useState<SignupData>(initialSignupData);
  const [getMapper , setMapperOptions] = useState(fallbackOptions);
  const [verificationSent, setVerificationSent] = useState(false);
  const [verificationSendCount, setVerificationSendCount] = useState(0);
  const [resendCooldownSeconds, setResendCooldownSeconds] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoUploads, setPhotoUploads] = useState<Record<string, SignupPhotoUpload>>({});
  const photoUploadPromises = useRef<Record<string, Promise<string>>>({});

 
 

  const steps = useMemo(
    () => [
      { eyebrow: 'Intent', title: 'Start with the good stuff' },
      { eyebrow: 'Basics', title: 'Tell us about you' },
      { eyebrow: 'Photos', title: 'Add your best shots' },
      { eyebrow: 'Bio', title: 'Add a spark' },
      // { eyebrow: 'Interests', title: 'Pick your favorites' },
      { eyebrow: 'Nearby', title: 'Find people nearby.' },
      { eyebrow: 'Phone', title: 'Verify your number' },
],
    [],
  );

  const updateSignupData = <K extends keyof SignupData>(field: K, value: SignupData[K]) => {
    setSignupData(prev => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    let mounted = true;

    cacheStorage
      .getMapper(false, ['intent', 'gender', 'interested_in'])
      .then(mapper => {
        if (!mounted || !mapper) return;

        setMapperOptions({
          intent: mapperToOptions(mapper, ['intent'], fallbackOptions.intent),
          gender: mapperToOptions(mapper, ['gender'], fallbackOptions.gender),
          interestedIn: mapperToOptions(mapper, ['interested_in', 'interestedIn'], fallbackOptions.interestedIn),
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


    if (step === 0 && !signupData.intent) {
      Toastx.show({ type: 'error', message: 'Choose what you are looking for.' });
      return false;
    }

    if (step === 1) {
      if (signupData.firstName.trim().length < 2) {
        Toastx.show({ type: 'error', message: 'Enter your first name.' });
        return false;
      }
      if (!birthdayIsValid()) {
        Toastx.show({ type: 'error', message: 'Enter a valid birthday. You must be 18+.' });
        return false;
      }
      if (!signupData.gender || !signupData.interestedIn) {
        Toastx.show({ type: 'error', message: 'Select your gender and who you want to meet.' });
        return false;
      }
    }

    if (step === 2 && signupData.photos.length < 2) {
      Toastx.show({ type: 'error', message: 'Add at least two photos.' });
      return false;
    }

    // if (step === 4 && signupData.interests.length < 3) {
    //   Toastx.show({ type: 'error', message: 'Pick at least 3 interests.' });
    //   return false;
    // }
    // Keep required checks local to the active step so the flow stays low-friction.
    if (step === 5 && !signupData.phoneVerified) {
      Toastx.show({ type: 'error', message: 'Verify your phone number to continue.' });
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
      Toastx.show({ type: 'error', message: result.errorMessage });
      return;
    }

    const selectedUris = (result.assets ?? [])
      .map(asset => asset.uri)
      .filter((uri): uri is string => Boolean(uri));

    if (selectedUris.length > 0) {
      const nextPhotos = [...signupData.photos, ...selectedUris].slice(0, 6);
      updateSignupData('photos', nextPhotos);
      selectedUris.forEach((uri, selectedIndex) => {
        uploadSignupPhoto(uri, signupData.photos.length + selectedIndex).catch(() => {
          Toastx.show({ type: 'error', message: 'A signup photo failed to upload. We will retry before signup.' });
        });
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

  const uploadSignupPhoto = (uri: string, index: number) => {
    if (photoUploadPromises.current[uri]) return photoUploadPromises.current[uri];

    const uploadPromise = (async () => {
      setPhotoUploads(prev => ({
        ...prev,
        [uri]: { status: 'uploading' },
      }));

      try {
        const ext = getFileExtension(uri);
        const contentType = getMimeTypeFromExt(ext);
        const presigned = await uploadHandler.requestPresignedURL_Upload(ext, 'signup-void');
        const uploadFilePath = uri.startsWith('file://') ? uri.replace('file://', '') : uri;

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

        const uploadedPath = "/" + uploadHandler.joinPath(presigned.bucket, presigned.fileKey);
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
        return uploadedPath ? Promise.resolve(uploadedPath) : uploadSignupPhoto(photoUri, index);
      }),
    );

    return uploadedPhotos;
  };

  const getSignupPhoneNumber = () => {
    const digits = signupData.phoneNumber.replace(/\D/g, '');
    return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
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
    // interests: signupData.interests,
    location: signupData.location,
  });

  const sendVerificationCode = async () => {
    if (resendCooldownSeconds > 0 || isSubmitting) return;

    if (getSignupPhoneNumber().length !== 10) {
      Toastx.show({ type: 'error', message: 'Enter a valid phone number.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${hostServer()}/api/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signupPayload()),
      });
      const result = await response.json();

      if (result?.code !== 200) {
        Toastx.show({ type: 'error', message: result?.message ?? 'Could not send verification code.' });
        return;
      }

      const nextSendCount = verificationSendCount + 1;
      setVerificationSendCount(nextSendCount);
      setResendCooldownSeconds(90 * nextSendCount);
      setVerificationSent(true);
      if (result?.dev_code) updateSignupData('verificationCode', String(result.dev_code));
      updateSignupData('phoneVerified', false);
      Toastx.show({ type: 'success', message: result?.message ?? 'Verification code sent.' });
    } catch {
      Toastx.show({ type: 'error', message: 'Could not send verification code.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmVerificationCode = async () => {
    if (signupData.verificationCode.replace(/\D/g, '').length !== 6) {
      Toastx.show({ type: 'error', message: 'Enter the 6-digit code.' });
      return false;
    }

    if (isSubmitting) return false;

    setIsSubmitting(true);
    Loaderx.show();
    try {
      const uploadedPhotos = await ensureSignupPhotoUploads();
      const response = await fetch(`${hostServer()}/api/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signupPayload(signupData.verificationCode, uploadedPhotos)),
      });
      const result = await response.json();

      if (result?.code !== 200) {
        Toastx.show({ type: 'error', message: result?.message ?? 'Signup failed.' });
        return false;
      }

      const auth = response.headers.get('x-omi-auth') ?? '';
      const hash = response.headers.get('x-omi-hash') ?? '';
      if (!auth || !hash) {
        Toastx.show({ type: 'error', message: 'Signup succeeded, but login session was not returned.' });
        return false;
      }
      await AsyncStorage.setItem(namer.storage.sessionId, auth);
      await AsyncStorage.setItem(namer.storage.sessionIdVerify, hash);
      await sessionManager.updateSession({
        x_omi_payload: auth,
        x_omi_payload_hash: hash,
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
      Toastx.show({ type: 'error', message: error?.message ?? 'Signup failed.' });
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
      ]}>
      {children}
    </Animated.View>
  );
 

  const renderIntentScreen = () =>
    renderStepShell(
      <StepScroll>
        <StepHeader eyebrow="Intent" title="What are you looking for?" />
        <View style={stylesx.optionStack}>
          {getMapper.intent.map((intent, index) => (
            <OptionCard
              key={intent.value}
              label={intent.label}
              value={intent.value}
              icon={['heart-outline', 'glass-cocktail', 'account-group-outline', 'compass-outline'][index]}
              selected={signupData.intent === intent.value}
              onPress={() => updateSignupData('intent', intent.value)}
            />
          ))}
        </View>
      </StepScroll>,
    );

  const renderBasicsScreen = () =>
    renderStepShell(
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <StepScroll>
          <StepHeader eyebrow="Basics" title="Tell us about you" helper="Keep it simple. You can edit these later." />
          <View style={stylesx.card}>
            <FieldLabel label="First name" />
            <TextInput
              style={stylesx.input}
              placeholder="Alex"
              placeholderTextColor="#9a9aae"
              value={signupData.firstName}
              onChangeText={value => updateSignupData('firstName', value)}
              maxLength={28}
              autoCapitalize="words"
            />

            <FieldLabel label="Birthday" helper="YYYY-MM-DD" />
            <TextInput
              style={stylesx.input}
              placeholder="1998-04-22"
              placeholderTextColor="#9a9aae"
              value={signupData.birthday}
              onChangeText={value => updateSignupData('birthday', formatBirthday(value))}
              keyboardType="number-pad"
              maxLength={10}
            />

            <FieldLabel label="Gender" />
            <View style={stylesx.chipWrap}>
              {getMapper.gender.map(gender => (
                <Chip
                  key={gender.value}
                  label={gender.label}
                  selected={signupData.gender === gender.value}
                  onPress={() => updateSignupData('gender', gender.value)}
                />
              ))}
            </View>

            <FieldLabel label="Interested in" />
            <View style={stylesx.chipWrap}>
              {getMapper.interestedIn.map(option => (
                <Chip
                  key={option.value}
                  label={option.label}
                  selected={signupData.interestedIn === option.value}
                  onPress={() => updateSignupData('interestedIn', option.value)}
                />
              ))}
            </View>
          </View>
        </StepScroll>
      </KeyboardAvoidingView>,
    );

  const renderPhotosScreen = () =>
    renderStepShell(
      <StepScroll>
        <StepHeader eyebrow="Photos" title="Add up to 6 photos" helper="At least two photos are required." />
        <View style={stylesx.photoGrid}>
          {Array.from({ length: 6 }).map((_, index) => {
            const photoUri = signupData.photos[index];
            return (
              <TouchableOpacity
                key={index}
                style={[stylesx.photoSlot, index === 0 && stylesx.primaryPhotoSlot]}
                activeOpacity={0.85}
                onPress={photoUri ? undefined : addPhoto}>
                {photoUri ? (
                  <>
                    <Image source={{ uri: photoUri }} style={stylesx.photoImage} />
                    <View style={stylesx.photoOverlay}>
                      <TouchableOpacity style={stylesx.photoIconButton} onPress={() => movePhoto(index, -1)}>
                        <MaterialCommunityIcons name="arrow-left" size={16} color="#ffffff" />
                      </TouchableOpacity>
                      <TouchableOpacity style={stylesx.photoIconButton} onPress={() => removePhoto(index)}>
                        <MaterialCommunityIcons name="trash-can-outline" size={16} color="#ffffff" />
                      </TouchableOpacity>
                      <TouchableOpacity style={stylesx.photoIconButton} onPress={() => movePhoto(index, 1)}>
                        <MaterialCommunityIcons name="arrow-right" size={16} color="#ffffff" />
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <View style={stylesx.emptyPhoto}>
                    <MaterialCommunityIcons name="plus" size={26} color="#e8546f" />
                    <Text style={stylesx.emptyPhotoText}>{index === 0 ? 'Main photo' : 'Add photo'}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity style={stylesx.secondaryButton} onPress={addPhoto}>
          <MaterialCommunityIcons name="image-plus" size={20} color="#e8546f" />
          <Text style={stylesx.secondaryButtonText}>Upload Photos</Text>
        </TouchableOpacity>
      </StepScroll>,
    );

  const renderBioScreen = () =>
    renderStepShell(
      <StepScroll>
        <StepHeader eyebrow="Bio" title="Write a short bio" helper="A few specific details beat a long resume." />
        <View style={stylesx.card}>
          <TextInput
            style={[stylesx.input, stylesx.bioInput]}
            placeholder="A tiny intro that makes someone want to say hi..."
            placeholderTextColor="#9a9aae"
            value={signupData.bio}
            onChangeText={value => updateSignupData('bio', value.slice(0, 240))}
            multiline
            textAlignVertical="top"
          />
          <Text style={stylesx.characterCount}>{signupData.bio.length}/240</Text>
        </View>
        <View style={stylesx.promptCard}>
          {promptExamples.map(prompt => (
            <TouchableOpacity
              key={prompt}
              style={stylesx.promptPill}
              onPress={() => updateSignupData('bio', signupData.bio ? `${signupData.bio}\n${prompt} ` : `${prompt} `)}>
              <Text style={stylesx.promptText}>{prompt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </StepScroll>,
    );

  // const renderInterestsScreen = () =>
  //   renderStepShell(
  //     <StepScroll>
  //       <StepHeader eyebrow="Interests" title="Choose at least 3" helper={`${signupData.interests.length}/3 selected`} />
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
          <MaterialCommunityIcons name="map-marker-radius-outline" size={52} color="#e8546f" />
        </View>
        <Text style={stylesx.heroTitle}>Find people nearby.</Text>
        <Text style={stylesx.heroCopy}>We use your location to show better matches.</Text>
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
              Toastx.show({ type: 'error', message: 'Unable to get current location.' });
            } finally {
              Loaderx.hide();
              setIsSubmitting(false);
            }
          }}>
          <Text style={stylesx.primaryButtonText}>Enable Location</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={stylesx.textButton}
          onPress={() => {
            updateSignupData('locationEnabled', false);
            goNext();
          }}>
          <Text style={stylesx.textButtonText}>Not Now</Text>
        </TouchableOpacity>
      </View>,
    );

  const verifyPhonenumber = () =>
    renderStepShell(
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <StepScroll>
          <StepHeader eyebrow="Phone" title="Verify your number" helper="We'll use this to keep accounts real." />
          <View style={stylesx.card}>
            <FieldLabel label="Phone number" />
            <TextInput
              style={stylesx.input}
              placeholder="(555) 123-4567"
              placeholderTextColor="#9a9aae"
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
            <TouchableOpacity
              style={[stylesx.secondaryButton, resendCooldownSeconds > 0 && stylesx.secondaryButtonDisabled]}
              onPress={sendVerificationCode}
              disabled={resendCooldownSeconds > 0}>
              <MaterialCommunityIcons name="message-processing-outline" size={20} color="#e8546f" />
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
                <FieldLabel label="Verification code" helper="6 digits" />
                <TextInput
                  style={[stylesx.input,{letterSpacing:5}]}
                  placeholder="123456"
                  placeholderTextColor="#9a9aae"
                  value={signupData.verificationCode}
                  onChangeText={value => {
                    updateSignupData('verificationCode', value.replace(/\D/g, '').slice(0, 6));
                      updateSignupData('phoneVerified', false);
                  }}
                  keyboardType="number-pad"
                  maxLength={6}
                />
                <TouchableOpacity style={stylesx.secondaryButton} onPress={confirmVerificationCode} disabled={isSubmitting}>
                  <MaterialCommunityIcons name="check-circle-outline" size={20} color="#e8546f" />
                  <Text style={stylesx.secondaryButtonText}>
                    {signupData.phoneVerified ? 'Verified' : 'Verify Code'}
                  </Text>
                </TouchableOpacity> 
              </>
            )}
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
    renderLocationScreen(),
    verifyPhonenumber(),
  ];

  return (
    <SafeAreaView style={stylesx.container} edges={['top', 'bottom']}>
      <View style={stylesx.topBar}>
        <TouchableOpacity
          style={ stylesx.backButton   } 
          onPress={step !== 0 ?goBack:()=>{navigationRef.goBack()}}>
          <MaterialCommunityIcons name="chevron-left" size={26} color="#2d2430" />
        </TouchableOpacity>
        <View style={stylesx.progressWrap}>
          <Text style={stylesx.progressText}>
            {steps[step].eyebrow} {step + 1}/{steps.length}
          </Text>
          <View style={stylesx.progressTrack}>
            <View style={[stylesx.progressFill, { width: `${((step + 1) / steps.length) * 100}%` }]} />
          </View>
        </View>
      </View>

      <ControlledCarousel
        ref={carouselRef}
        pages={pages}
        onPageChange={index => animatePageChange(index)}
      />

      {step !== 5 && (
        <View style={stylesx.footer}>
          <TouchableOpacity style={stylesx.primaryButton} onPress={goNext}>
            <Text style={stylesx.primaryButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const OptionCard = ({ label, selected, onPress, icon = 'heart-outline' }: OptionCardProps) => (
  <TouchableOpacity style={[stylesx.optionCard, selected && stylesx.optionCardSelected]} onPress={onPress}>
    <View style={[stylesx.optionIcon, selected && stylesx.optionIconSelected]}>
      <MaterialCommunityIcons name={icon} size={22} color={selected ? '#ffffff' : '#e8546f'} />
    </View>
    <Text style={[stylesx.optionText, selected && stylesx.optionTextSelected, {textTransform:"capitalize"}]}>{label}</Text>
    {selected && <MaterialCommunityIcons name="check-circle" size={22} color="#e8546f" />}
  </TouchableOpacity>
);

const Chip = ({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) => (
  <TouchableOpacity style={[stylesx.chip, selected && stylesx.chipSelected]} onPress={onPress}>
    <Text style={[stylesx.chipText, selected && stylesx.chipTextSelected,{textTransform:"capitalize"}]}>{label}</Text>
  </TouchableOpacity>
);

const StepHeader = ({ eyebrow, title, helper }: { eyebrow: string; title: string; helper?: string }) => (
  <View style={stylesx.stepHeader}>
    <Text style={stylesx.eyebrow}>{eyebrow}</Text>
    <Text style={stylesx.stepTitle}>{title}</Text>
    {helper && <Text style={stylesx.stepHelper}>{helper}</Text>}
  </View>
);

const FieldLabel = ({ label, helper }: { label: string; helper?: string }) => (
  <View style={stylesx.fieldLabelRow}>
    <Text style={stylesx.fieldLabel}>{label}</Text>
    {helper && <Text style={stylesx.fieldHelper}>{helper}</Text>}
  </View>
);

const StepScroll = ({ children }: { children: React.ReactNode }) => (
  <ScrollView
    style={{ flex: 1 }}
    showsVerticalScrollIndicator={false}
    keyboardShouldPersistTaps="handled"
    contentContainerStyle={stylesx.scrollContent}>
    {children}
  </ScrollView>
);

const stylesx = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff8fa',
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
    backgroundColor: '#ffffff',
    shadowColor: '#2b1020',
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
    color: '#7d6770',
    textTransform: 'uppercase',
  },
  progressTrack: {
    height: 7,
    borderRadius: 7,
    overflow: 'hidden',
    backgroundColor: '#f2dbe2',
  },
  progressFill: {
    height: '100%',
    borderRadius: 7,
    backgroundColor: '#e8546f',
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
    backgroundColor: '#e8546f',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#e8546f',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
  heroTitle: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '900',
    color: '#2d2430',
    textAlign: 'center',
  },
  heroCopy: {
    fontSize: 16,
    lineHeight: 23,
    color: '#74636b',
    textAlign: 'center',
    maxWidth: 330,
  },
  previewCard: {
    width: '100%',
    maxWidth: 310,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 12,
    shadowColor: '#2b1020',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 6,
  },
  previewPhoto: {
    height: 240,
    borderRadius: 14,
    backgroundColor: '#e8546f',
  },
  previewBody: {
    paddingTop: 12,
  },
  previewName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#2d2430',
  },
  previewMeta: {
    marginTop: 4,
    fontSize: 14,
    color: '#74636b',
  },
  stepHeader: {
    gap: 8,
    marginBottom: 2,
  },
  eyebrow: {
    color: '#e8546f',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  stepTitle: {
    color: '#2d2430',
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
  },
  stepHelper: {
    color: '#74636b',
    fontSize: 15,
    lineHeight: 21,
  },
  optionStack: {
    gap: 12,
  },
  optionCard: {
    minHeight: 74,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1dce3',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#2b1020',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  optionCardSelected: {
    borderColor: '#e8546f',
    backgroundColor: '#fff1f5',
  },
  optionIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffe4eb',
  },
  optionIconSelected: {
    backgroundColor: '#e8546f',
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    color: '#2d2430',
    fontWeight: '800',
  },
  optionTextSelected: {
    color: '#e8546f',
  },
  card: {
    borderRadius: 18,
    backgroundColor: '#ffffff',
    padding: 16,
    gap: 12,
    shadowColor: '#2b1020',
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
    color: '#2d2430',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  fieldHelper: {
    color: '#9b8790',
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: '#fbf5f7',
    borderWidth: 1,
    borderColor: '#efdbe2',
    paddingHorizontal: 14,
    color: '#2d2430',
    fontSize: 16,
    fontWeight: '700',
  },
  bioInput: {
    minHeight: 150,
    paddingTop: 14,
    lineHeight: 22,
  },
  characterCount: {
    alignSelf: 'flex-end',
    color: '#9b8790',
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
    backgroundColor: '#fbf5f7',
    borderWidth: 1,
    borderColor: '#efdbe2',
  },
  chipSelected: {
    backgroundColor: '#e8546f',
    borderColor: '#e8546f',
  },
  chipText: {
    color: '#5c4c54',
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
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#efdbe2',
    shadowColor: '#2b1020',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 3,
  },
  primaryPhotoSlot: {
    borderColor: '#e8546f',
  },
  emptyPhoto: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyPhotoText: {
    color: '#8f747f',
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
    borderColor: '#f2c9d4',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButtonDisabled: {
    opacity: 0.55,
  },
  secondaryButtonText: {
    color: '#e8546f',
    fontSize: 15,
    fontWeight: '900',
  },
  promptCard: {
    gap: 10,
  },
  promptPill: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#efdbe2',
    padding: 14,
  },
  promptText: {
    color: '#5c4c54',
    fontWeight: '800',
    fontSize: 15,
  },
  locationIcon: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2b1020',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 22,
    elevation: 6,
  },
  completeIcon: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: '#28b686',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#28b686',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 6,
  },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: '#fff8fa',
  },
  primaryButton: {
    width: '100%',
    minHeight: 56,
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
    color: '#74636b',
    fontSize: 15,
    fontWeight: '900',
  },
});
