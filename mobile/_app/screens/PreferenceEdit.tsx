import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import IIcon from 'react-native-vector-icons/Ionicons';
import { Loaderx } from '../funcs/functions_stateful';
import RadioGroup from 'react-native-radio-buttons-group';
import RangeSlider from 'rn-range-slider';
import { namer, styles, __CONFIG__ } from '../funcs/static';
import { _http_request, cacheStorage, help } from '../funcs/functions';
import { AccordionItem } from '../funcs/customAccordion';
import { onPaymentRefreshed } from '../funcs/functions/paymentNotices';
import { Toastx } from '../funcs/customNotification';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, ThemeColors, elevation } from '../funcs/theme';
import { useUnits, formatDistanceLimit } from '../funcs/units';

const defaultPreferences = {
  minAge: '19',
  maxAge: '47',
  gender: '-99',
  children: '-99',
  smoking: '-99',
  drinking: '-99',
  relationshipGoal: '-99',
  highEducation: '-99',
  ethnicity: '-99',
  languages: '-99',
  pets: '-99',
  religion: '-99',
  politicalview: '-99',
  distance: { miles: 25, km: '40' },
};

// Search radius range -- matches the server's SEARCH_DISTANCE_MILES (no "no limit")
const MIN_DISTANCE_MILES = 5;
const MAX_DISTANCE_MILES = 100;

function buildPreferencesPayload(
  preferences: typeof defaultPreferences,
  distanceMiles: number,
) {
  return {
    min_age: preferences.minAge,
    max_age: preferences.maxAge,
    pref_smoking: preferences.smoking,
    pref_drinking: preferences.drinking,
    pref_children: preferences.children,
    pref_ethnicity: preferences.ethnicity,
    pref_pet: preferences.pets,
    pref_religion: preferences.religion,
    pref_politicalview: preferences.politicalview,
    pref_highesteducation: preferences.highEducation,
    pref_relationshipgoal: preferences.relationshipGoal,
    pref_languages: preferences.languages,
    pref_gender: preferences.gender,
    pref_distance: distanceMiles,
  };
}

export function Screen_editpreference({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const { unit } = useUnits();
  const localStyles = useMemo(() => createLocalStyles(colors), [colors]);
  const [getProfile, setProfile] = useState<any>(null);

  const __MAPPER = cacheStorage.CONFIG.get()?.mapper;

  const [preferences, setPreferences] = useState(defaultPreferences);

  const hasPremium =
    help.getSubscriptionState(getProfile).features.advancedFilters;
  const hasTravelMode =
    help.getSubscriptionState(getProfile).features.travelMode;

  const [getDistance, setDistance] = useState<{ miles: number; km: string }>({
    miles: defaultPreferences.distance.miles,
    km: defaultPreferences.distance.km,
  });

  // pushProfile body as last loaded -- leaving the screen only saves when the
  // current body differs from this
  const savedPayloadRef = React.useRef(
    JSON.stringify(
      buildPreferencesPayload(
        defaultPreferences,
        defaultPreferences.distance.miles,
      ),
    ),
  );

  // Coming back from an upgrade: pick up the new plan so the filters unlock. Only
  // the profile (plan) is replaced -- unsaved preference edits stay as they are.
  useEffect(() => {
    const reloadPlan = () => {
      cacheStorage
        .getCurrentUserProfile()
        .then((profile: any) => profile && setProfile(profile))
        .catch(() => {});
    };
    const unsubscribeFocus = navigation.addListener('focus', reloadPlan);
    const unsubscribePayment = onPaymentRefreshed(reloadPlan);
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

        if (mounted) {
          setProfile(profile);
          const profilePreferences = profile?.preferences ?? {};
          // Capped at MAX_DISTANCE_MILES -- older "no limit" saves (-99 / 105)
          // show as the max, which is what the server searches anyway
          const savedMiles = Number(
            profilePreferences?.distance ?? defaultPreferences.distance.miles,
          );
          const distanceMiles =
            Number.isFinite(savedMiles) && savedMiles > 0
              ? Math.min(savedMiles, MAX_DISTANCE_MILES)
              : MAX_DISTANCE_MILES;
          const nextPreferences = {
            minAge:
              profilePreferences?.minimum_age?.toString() ??
              defaultPreferences.minAge,
            maxAge:
              profilePreferences?.maximum_age?.toString() ??
              defaultPreferences.maxAge,
            gender:
              profilePreferences?.gender?.toString() ??
              defaultPreferences.gender,
            children:
              profilePreferences?.children?.toString() ??
              defaultPreferences.children,
            smoking:
              profilePreferences?.smoking?.toString() ??
              defaultPreferences.smoking,
            drinking:
              profilePreferences?.drinking?.toString() ??
              defaultPreferences.drinking,
            relationshipGoal:
              profilePreferences?.relationshipgoal?.toString() ??
              defaultPreferences.relationshipGoal,
            highEducation:
              profilePreferences?.education?.toString() ??
              defaultPreferences.highEducation,
            ethnicity:
              profilePreferences?.ethnicity?.toString() ??
              defaultPreferences.ethnicity,
            languages: Array.isArray(profilePreferences?.language)
              ? profilePreferences.language[0]?.toString() ??
                defaultPreferences.languages
              : profilePreferences?.language?.toString() ??
                defaultPreferences.languages,
            pets:
              profilePreferences?.pet?.toString() ?? defaultPreferences.pets,
            religion:
              profilePreferences?.religion?.toString() ??
              defaultPreferences.religion,
            politicalview:
              profilePreferences?.politicalview?.toString() ??
              defaultPreferences.politicalview,
            distance: {
              miles: distanceMiles,
              km:
                help.milesToKM(distanceMiles)?.toString() ??
                defaultPreferences.distance.km,
            },
          };

          savedPayloadRef.current = JSON.stringify(
            buildPreferencesPayload(
              nextPreferences,
              nextPreferences.distance.miles,
            ),
          );
          setPreferences(nextPreferences);
          setDistance(nextPreferences.distance);
        }
      } catch {
        if (mounted) {
          setProfile(null);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const radioButtons = {
    getGender: [
      ...Object.entries(__MAPPER?.bio_gender ?? {}),
      ['-99', 'Open to all'],
    ] as [string, string][],
    getChildren: [
      ...Object.entries(__MAPPER?.bio_children ?? {}),
      ['-99', 'Open to all'],
    ] as [string, string][],
    getSmoking: [
      ...Object.entries(__MAPPER?.bio_smoking ?? {}),
      ['-99', 'Open to all'],
    ] as [string, string][],
    getDrinking: [
      ...Object.entries(__MAPPER?.bio_drinking ?? {}),
      ['-99', 'Open to all'],
    ] as [string, string][],
    getRelationshipGoal: [
      ...Object.entries(__MAPPER?.bio_intent ?? {}),
      ['-99', 'Open to all'],
    ] as [string, string][],
    getHighEducation: [
      ...Object.entries(__MAPPER?.bio_education ?? {}),
      ['-99', 'Open to all'],
    ] as [string, string][],
    getEthnicity: [
      ...Object.entries(__MAPPER?.bio_ethnicity ?? {}),
      ['-99', 'Open to all'],
    ] as [string, string][],
    getPets: [
      ...Object.entries(__MAPPER?.bio_pets ?? {}),
      ['-99', 'Open to all'],
    ] as [string, string][],
    getReligion: [
      ...Object.entries(__MAPPER?.bio_religion ?? {}),
      ['-99', 'Open to all'],
    ] as [string, string][],
    getPoliticalView: [
      ...Object.entries(__MAPPER?.bio_politicalview ?? {}),
      ['-99', 'Open to all'],
    ] as [string, string][],
    getLanguages: [
      ...Object.entries(__MAPPER?.bio_language ?? {}),
      ['-99', 'Open to all'],
    ] as [string, string][],
  };

  const persistPreferences = useCallback(async () => {
    const payload = buildPreferencesPayload(preferences, getDistance.miles);
    const serialized = JSON.stringify(payload);
    if (serialized === savedPayloadRef.current) return;

    Loaderx.show();
    try {
      const response = await _http_request({
        customApiUrl: __CONFIG__.HTTPS_API_DOMAIN + '/api/core/v1/pushProfile',
        reqType: 'POST',
        bodyArray: payload,
      });

      if (response?.code === 200) {
        savedPayloadRef.current = serialized;
        Toastx.show({
          type: 'success',
          message: response?.message ?? 'Preferences updated!',
        });
        await cacheStorage.getCurrentUserProfile(true);
      } else {
        Toastx.show({
          type: response?.code === 203 ? 'info' : 'error',
          message: response?.message ?? 'Error updating preference!',
        });
      }
    } finally {
      Loaderx.hide();
    }
  }, [getDistance.miles, preferences]);

  // Autosave whenever the screen is left (back gesture, hardware back,
  // header back button, or the explicit Save button below) -- a no-op when
  // nothing changed since load.
  const hasAutoSavedRef = React.useRef(false);
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      if (hasAutoSavedRef.current) {
        return;
      }
      e.preventDefault();
      hasAutoSavedRef.current = true;
      persistPreferences().finally(() => {
        navigation.dispatch(e.data.action);
      });
    });
    return unsubscribe;
  }, [navigation, persistPreferences]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitleAlign: 'center',
      headerStyle: { backgroundColor: colors.background },
      headerShadowVisible: false,
      headerTitle: () => (
        <Text style={{ fontSize: 18, fontWeight: '700' }}>
          Edit Preferences
        </Text>
      ),
      headerRight: () => (
        <Pressable
          style={{ paddingVertical: 6 }}
          hitSlop={10}
          onPress={() => navigation.goBack()}
        >
          <Text
            style={[
              styles.pressableButtonText,
              { fontSize: 14, fontWeight: '500', color: colors.accent },
            ]}
          >
            Save
          </Text>
        </Pressable>
      ),
    });
  }, [navigation, colors.accent, colors.background]);

  const renderRadioAccordion = (
    title: string,
    selectedId: string,
    options: [string, string][],
    onPress: (id: string) => void,
    subtitlePrefix?: string,
    isLast?: boolean,
  ) => (
    <AccordionItem
      title={title}
      isLast={isLast}
      subtitle={`${subtitlePrefix ?? ''}${
        options.find(([key]) => key === selectedId)?.[1] || 'Not set'
      }`}
      Content={() => (
        <View>
          <RadioGroup
            labelStyle={{ fontSize: 16, textTransform: 'capitalize' }}
            radioButtons={options.map(([key, value]) => ({
              id: key,
              label: value,
              value,
              borderColor: colors.border,
              color: colors.accent,
              containerStyle: localStyles.optionRow,
            }))}
            containerStyle={{ alignItems: 'stretch', gap: 8 }}
            onPress={onPress}
            selectedId={selectedId}
          />
        </View>
      )}
    />
  );

  // One card per kind of premium filter (lifestyle, background, education).
  // Locked plans still see what's in each card -- dimmed, with a lock chip --
  // and tapping it goes to plans. The server ignores these filters for plans
  // without them regardless (api getPeopleToMatch paidFilter).
  const renderPremiumGroup = (
    title: string,
    icon: string,
    children: React.ReactNode,
  ) => (
    <View style={localStyles.premiumGroup}>
      <View style={localStyles.premiumGroupHeader}>
        <View style={localStyles.premiumGroupIcon}>
          <IIcon name={icon} size={16} color={colors.primary} />
        </View>
        <Text style={localStyles.premiumGroupTitle}>{title}</Text>
        {!hasPremium && (
          <View style={localStyles.premiumBadge}>
            <IIcon name="lock-closed" size={11} color={colors.premium} />
            <Text style={localStyles.premiumBadgeText}>Plus</Text>
          </View>
        )}
      </View>
      <Pressable
        disabled={hasPremium}
        onPress={() =>
          navigation.push(namer.navigation.subscription, { tab: 'plus' })
        }
      >
        <View
          pointerEvents={hasPremium ? 'auto' : 'none'}
          style={[
            localStyles.groupInner,
            !hasPremium && localStyles.moreDisabledBlock,
          ]}
        >
          {children}
        </View>
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.container, localStyles.root, {}]}
      edges={['bottom']}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.conainerScrollView,
          localStyles.contentContainer,
        ]}
      >
        <View style={{ gap: 12 }}>
          <Text style={localStyles.sectionHeaderText}>Basic filters</Text>
          <View
            style={[
              styles.editprofile_inputborder,
              localStyles.card,
              { paddingHorizontal: 10, borderColor: colors.border },
            ]}
          >
            <View
              style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}
            >
              <Text style={localStyles.inputTitle}>Age range</Text>
              <Text style={localStyles.inputSubTitle}>
                Between {preferences.minAge} - {preferences.maxAge}
              </Text>
              <RangeSlider
                style={{ width: '100%', height: 30 }}
                low={parseInt(preferences.minAge, 10) ?? 18}
                high={parseInt(preferences.maxAge, 10) ?? 19}
                min={18}
                max={100}
                step={1}
                floatingLabel={true}
                minRange={2}
                onValueChanged={(low: number, high: number) => {
                  if (low.toString() !== preferences.minAge)
                    setPreferences(prev => ({
                      ...prev,
                      minAge: low.toString(),
                    }));
                  if (high.toString() !== preferences.maxAge)
                    setPreferences(prev => ({
                      ...prev,
                      maxAge: high.toString(),
                    }));
                }}
                renderThumb={() => (
                  <View
                    style={[styles.slider_thumb, localStyles.sliderThumb]}
                  />
                )}
                renderRail={() => (
                  <View style={[styles.slider_rail, localStyles.sliderRail]} />
                )}
                renderRailSelected={() => (
                  <View
                    style={[
                      styles.slider_railSelected,
                      localStyles.sliderRailSelected,
                    ]}
                  />
                )}
              />
            </View>

            <View>
              <Text style={localStyles.inputTitle}>{`Distance from you (${
                getProfile?.profile?.location?.city || 'your area'
              })`}</Text>
              <Text style={localStyles.inputSubTitle}>
                {`Up to ${formatDistanceLimit(
                  getDistance.miles,
                  unit,
                )} from you`}
              </Text>
              <RangeSlider
                disableRange={true}
                style={{ width: '100%', height: 30 }}
                low={getDistance.miles ?? 55}
                high={getDistance.miles ?? 60}
                min={MIN_DISTANCE_MILES}
                max={MAX_DISTANCE_MILES}
                step={5}
                onValueChanged={(va: number) => {
                  if (va !== getDistance.miles) {
                    setDistance({
                      miles: va,
                      km: help.milesToKM(va)?.toString() ?? 'n/a',
                    });
                  }
                }}
                renderThumb={() => (
                  <View
                    style={[styles.slider_thumb, localStyles.sliderThumb]}
                  />
                )}
                renderRail={() => (
                  <View style={[styles.slider_rail, localStyles.sliderRail]} />
                )}
                renderRailSelected={() => (
                  <View
                    style={[
                      styles.slider_railSelected,
                      localStyles.sliderRailSelected,
                    ]}
                  />
                )}
              />
            </View>
          </View>

          <Pressable
            style={[localStyles.group, localStyles.travelRow]}
            onPress={() => navigation.push(namer.navigation.editLocation)}
          >
            <View style={localStyles.premiumGroupIcon}>
              <IIcon name="airplane-outline" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={localStyles.travelTitle}>Travel mode</Text>
              <Text style={localStyles.travelSubtitle}>
                Match with people in up to 2 more cities
              </Text>
            </View>
            {!hasTravelMode && (
              <View style={localStyles.premiumBadge}>
                <IIcon name="lock-closed" size={11} color={colors.premium} />
                <Text style={localStyles.premiumBadgeText}>VIP</Text>
              </View>
            )}
            <IIcon
              name="chevron-forward"
              size={18}
              color={colors.textTertiary}
            />
          </Pressable>

          <View style={localStyles.group}>
            <View style={localStyles.groupInner}>
              {renderRadioAccordion(
                'What gender are you interested in?',
                preferences.gender,
                radioButtons.getGender,
                id => setPreferences(prev => ({ ...prev, gender: id })),
              )}
              {renderRadioAccordion(
                'What are your intentions?',
                preferences.relationshipGoal,
                radioButtons.getRelationshipGoal,
                id =>
                  setPreferences(prev => ({
                    ...prev,
                    relationshipGoal: id,
                  })),
                undefined,
                true,
              )}
            </View>
          </View>

          <View style={localStyles.sectionHeaderRow}>
            <Text style={localStyles.sectionHeaderText}>Plus filters</Text>
            {!hasPremium && (
              <View style={localStyles.premiumBadge}>
                <IIcon name="lock-closed" size={11} color={colors.premium} />
                <Text style={localStyles.premiumBadgeText}>Plus</Text>
              </View>
            )}
          </View>

          {!hasPremium ? (
            <View style={localStyles.paywallCard}>
              <View style={localStyles.paywallIconWrap}>
                <IIcon name="sparkles" size={22} color={colors.premium} />
              </View>
              <Text style={localStyles.paywallTitle}>
                Unlock filters with Plus
              </Text>
              <Text style={localStyles.paywallSubTitle}>
                Plus and VIP unlock advanced matching by habits, lifestyle,
                education, ethnicity, religion, pets, and more.
              </Text>
              <Pressable
                style={localStyles.upgradeBtn}
                onPress={() =>
                  navigation.push(namer.navigation.subscription, {
                    tab: 'plus',
                  })
                }
              >
                <Text style={localStyles.upgradeBtnText}>Upgrade</Text>
              </Pressable>
            </View>
          ) : null}

          {renderPremiumGroup(
            'Lifestyle',
            'leaf-outline',
            <>
              {renderRadioAccordion(
                'Should they have kids?',
                preferences.children,
                radioButtons.getChildren,
                id => setPreferences(prev => ({ ...prev, children: id })),
              )}
              {renderRadioAccordion(
                'Should they drink?',
                preferences.drinking,
                radioButtons.getDrinking,
                id => setPreferences(prev => ({ ...prev, drinking: id })),
              )}
              {renderRadioAccordion(
                'Should they smoke?',
                preferences.smoking,
                radioButtons.getSmoking,
                id => setPreferences(prev => ({ ...prev, smoking: id })),
              )}
              {renderRadioAccordion(
                'Should they have pet(s)?',
                preferences.pets,
                radioButtons.getPets,
                id => setPreferences(prev => ({ ...prev, pets: id })),
                undefined,
                true,
              )}
            </>,
          )}
          {renderPremiumGroup(
            'Background & beliefs',
            'earth-outline',
            <>
              {renderRadioAccordion(
                'Preferred ethnicity?',
                preferences.ethnicity,
                radioButtons.getEthnicity,
                id => setPreferences(prev => ({ ...prev, ethnicity: id })),
              )}
              {renderRadioAccordion(
                'Preferred religion?',
                preferences.religion,
                radioButtons.getReligion,
                id => setPreferences(prev => ({ ...prev, religion: id })),
              )}
              {renderRadioAccordion(
                'Preferred political views?',
                preferences.politicalview,
                radioButtons.getPoliticalView,
                id => setPreferences(prev => ({ ...prev, politicalview: id })),
                undefined,
                true,
              )}
            </>,
          )}
          {renderPremiumGroup(
            'Education & language',
            'school-outline',
            <>
              {renderRadioAccordion(
                'Preferred highest education?',
                preferences.highEducation,
                radioButtons.getHighEducation,
                id => setPreferences(prev => ({ ...prev, highEducation: id })),
              )}
              {renderRadioAccordion(
                'Preferred language?',
                preferences.languages,
                radioButtons.getLanguages,
                id => setPreferences(prev => ({ ...prev, languages: id })),
                undefined,
                true,
              )}
            </>,
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createLocalStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      paddingHorizontal: 0,
      backgroundColor: colors.background,
    },
    contentContainer: {
      gap: 12,
    },
    heroCard: {
      backgroundColor: '#0f172a',
      borderRadius: 18,
      padding: 16,
      marginHorizontal: 10,
    },
    heroTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    heroBadge: {
      backgroundColor: '#0ea5e9',
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    heroBadgeText: {
      color: '#082f49',
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
    },
    heroHint: {
      color: '#cbd5e1',
      fontSize: 12,
    },
    heroTitle: {
      color: '#fff',
      fontSize: 22,
      fontWeight: '800',
    },
    heroSubtitle: {
      color: '#cbd5e1',
      fontSize: 13,
      marginTop: 6,
      lineHeight: 18,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 2,
    },
    sectionHeaderText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      paddingHorizontal: 2,
    },
    premiumBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.premiumSoft,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    premiumBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.premium,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    card: {
      marginHorizontal: 0,
      borderRadius: 14,
      backgroundColor: colors.surface,
      ...elevation(colors.shadow, 1),
    },
    group: {
      borderRadius: 14,
      backgroundColor: colors.surface,
      ...elevation(colors.shadow, 1),
    },
    travelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    travelTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
    travelSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    groupInner: {
      borderRadius: 14,
      overflow: 'hidden',
    },
    optionRow: {
      flexDirection: 'row-reverse',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
      marginHorizontal: 0,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      backgroundColor: colors.surface,
    },
    inputTitle: {
      fontSize: 16,
      marginTop: 10,
      fontWeight: '700',
      textTransform: 'capitalize',
      color: colors.text,
    },
    inputSubTitle: {
      fontSize: 13,
      marginTop: 5,
      marginBottom: 10,
      textTransform: 'capitalize',
      color: colors.textSecondary,
    },
    paywallCard: {
      marginHorizontal: 10,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.premiumSoft,
      padding: 16,
      alignItems: 'center',
      gap: 10,
      ...elevation(colors.shadow, 1),
    },
    premiumGroup: {
      borderRadius: 14,
      backgroundColor: colors.surface,
      paddingTop: 12,
      ...elevation(colors.shadow, 1),
    },
    premiumGroupHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
      paddingBottom: 6,
    },
    premiumGroupIcon: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primarySoft,
    },
    premiumGroupTitle: {
      flex: 1,
      fontSize: 15.5,
      fontWeight: '700',
      color: colors.text,
    },
    moreDisabledBlock: {
      opacity: 0.5,
    },
    paywallIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.premiumSoft,
    },
    paywallTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.text,
    },
    paywallSubTitle: {
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
      color: colors.textSecondary,
    },
    upgradeBtn: {
      backgroundColor: colors.premium,
      borderRadius: 12,
      width: '100%',
      paddingVertical: 13,
      alignItems: 'center',
      marginTop: 6,
    },
    sliderThumb: {
      backgroundColor: colors.primary,
      shadowColor: colors.shadow,
    },
    sliderRail: { backgroundColor: colors.border },
    sliderRailSelected: { backgroundColor: colors.primary },
    upgradeBtnText: {
      color: colors.onPrimary,
      fontSize: 15,
      fontWeight: '800',
    },
  });
}
