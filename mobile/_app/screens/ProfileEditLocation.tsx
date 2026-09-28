import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import IIcon from 'react-native-vector-icons/Ionicons';
import { _http_request, maybePushLocation } from '../funcs/functions';
import { __CONFIG__, namer } from '../funcs/static';
import { Toastx } from '../funcs/customNotification';
import { Dialogx } from '../funcs/customDialog';
import { onPaymentRefreshed } from '../funcs/functions/paymentNotices';
import { useTheme, ThemeColors } from '../funcs/theme';

type Place = {
  id?: number;
  city?: string;
  state?: string;
  country?: string;
  display_name?: string;
  latd?: number;
  long?: number;
};

type LocationsState = {
  primary: Place;
  secondary: Place[];
  travelMode: boolean;
  canUseTravelMode: boolean;
  maxSecondary: number;
};

const SEARCH_DEBOUNCE_MS = 400;

const coreApi = (action: string, bodyArray?: Record<string, any>) =>
  _http_request({
    customApiUrl: __CONFIG__.HTTPS_API_DOMAIN + '/api/core/v1/' + action,
    reqType: 'POST',
    bodyArray,
  });

const known = (v?: string) => (v && v !== 'unknown' ? v : '');
const placeTitle = (p: Place) =>
  [known(p.city), known(p.state)].filter(Boolean).join(', ') ||
  known(p.display_name) ||
  'Unknown place';

export function Screen_editProfileLocation({
  navigation,
  route,
}: {
  navigation: any;
  route: any;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  // lets Edit Profile show the new city without refetching the whole profile
  const onPrimaryChange: ((city: string) => void) | undefined =
    route.params?.onPrimaryChange;

  const [state, setState] = useState<LocationsState | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTogglingTravel, setIsTogglingTravel] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const searchSeq = useRef(0);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => <Text style={styles.headerTitle}>Location</Text>,
    });
  }, [navigation, styles.headerTitle]);

  const load = useCallback(async () => {
    const res = await coreApi('getLocations');
    if (res?.code !== 200) {
      Toastx.show({
        type: 'error',
        message: res?.message ?? 'Could not load locations.',
      });
      return;
    }
    setState({
      primary: res.primary ?? {},
      secondary: Array.isArray(res.secondary) ? res.secondary : [],
      travelMode: res.travel_mode === true,
      canUseTravelMode: res.can_use_travel_mode === true,
      maxSecondary: Number(res.max_secondary ?? 2),
    });
  }, []);

  // Reload on focus too: coming back from buying VIP should unlock travel mode
  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', load);
    const unsubscribePayment = onPaymentRefreshed(load);
    return () => {
      unsubscribeFocus();
      unsubscribePayment();
    };
  }, [navigation, load]);

  // Debounced city search; the sequence number drops responses that arrive out of order
  useEffect(() => {
    const q = query.trim();
    if (!isSearchOpen || q.length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const seq = ++searchSeq.current;
    const timer = setTimeout(async () => {
      const res = await coreApi('getPlaceSearch', { q });
      if (seq !== searchSeq.current) return;
      setIsSearching(false);
      if (res?.code === 200) {
        setResults(Array.isArray(res.places) ? res.places : []);
      } else {
        setResults([]);
        Toastx.show({
          type: 'error',
          message: res?.message ?? 'Search failed.',
        });
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, isSearchOpen]);

  const refreshPrimary = async () => {
    setIsRefreshing(true);
    try {
      const place = await maybePushLocation({ force: true });
      if (!place) {
        Toastx.show({
          type: 'error',
          message: "Couldn't get your current location.",
        });
        return;
      }
      setState(prev => (prev ? { ...prev, primary: place } : prev));
      onPrimaryChange?.(known(place.city));
      Toastx.show({ type: 'success', message: 'Location updated.' });
    } finally {
      setIsRefreshing(false);
    }
  };

  const toggleTravelMode = async (enabled: boolean) => {
    if (!state) return;
    setIsTogglingTravel(true);
    setState({ ...state, travelMode: enabled });
    const res = await coreApi('pushTravelMode', {
      enabled: enabled ? '1' : '0',
    });
    setIsTogglingTravel(false);
    if (res?.code !== 200) {
      setState(prev => (prev ? { ...prev, travelMode: !enabled } : prev));
      Toastx.show({
        type: 'error',
        message: res?.message ?? 'Could not update travel mode.',
      });
    }
  };

  const addPlace = async (place: Place, key: string) => {
    setAddingKey(key);
    const res = await coreApi('pushSecondaryLocation', {
      latd: place.latd,
      long: place.long,
    });
    setAddingKey(null);
    if (res?.code !== 200 || !res.location) {
      Toastx.show({
        type: 'error',
        message: res?.message ?? 'Could not add location.',
      });
      return;
    }
    setState(prev =>
      prev ? { ...prev, secondary: [...prev.secondary, res.location] } : prev,
    );
    setIsSearchOpen(false);
    setQuery('');
  };

  const removePlace = async (place: Place) => {
    const ok = await Dialogx.confirm({
      title: 'Remove location?',
      message: `${placeTitle(place)} will no longer be used for travel mode.`,
      confirmText: 'Remove',
      destructive: true,
    });
    if (!ok || place.id == null) return;
    setRemovingId(place.id);
    const res = await coreApi('pushDeleteSecondaryLocation', { id: place.id });
    setRemovingId(null);
    if (res?.code !== 200) {
      Toastx.show({
        type: 'error',
        message: res?.message ?? 'Could not remove location.',
      });
      return;
    }
    setState(prev =>
      prev
        ? { ...prev, secondary: prev.secondary.filter(p => p.id !== place.id) }
        : prev,
    );
  };

  if (!state) {
    return (
      <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
        <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} />
      </SafeAreaView>
    );
  }

  const canAddMore = state.secondary.length < state.maxSecondary;

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Current location ─────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Current location</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.iconWrap}>
              <IIcon name="navigate" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.placeTitle}>{placeTitle(state.primary)}</Text>
              {!!known(state.primary.country) && (
                <Text style={styles.placeSubtitle}>
                  {known(state.primary.country)}
                </Text>
              )}
            </View>
            <Pressable
              style={styles.refreshButton}
              onPress={refreshPrimary}
              disabled={isRefreshing}
              hitSlop={8}
              accessibilityLabel="Refresh current location"
            >
              {isRefreshing ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <IIcon name="refresh" size={18} color={colors.primary} />
              )}
            </Pressable>
          </View>
        </View>
        <Text style={styles.hint}>
          Your location is updated from this device. Refresh if you've moved.
        </Text>

        {/* ── Travel mode (VIP) ────────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>Travel mode</Text>
          <View style={styles.vipBadge}>
            <Text style={styles.vipBadgeText}>VIP</Text>
          </View>
        </View>

        {!state.canUseTravelMode ? (
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.iconWrap}>
                <IIcon name="airplane" size={18} color={colors.primary} />
              </View>
              <Text style={[styles.hint, styles.lockedText]}>
                Add up to {state.maxSecondary} more cities to meet people there
                before you arrive.
              </Text>
            </View>
            <Pressable
              style={styles.primaryButton}
              onPress={() =>
                navigation.navigate(namer.navigation.subscription, {
                  tab: 'vip',
                })
              }
            >
              <IIcon name="lock-open-outline" size={16} color="#fff" />
              <Text style={styles.primaryButtonText}>Upgrade to VIP</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.placeTitle}>Travel mode</Text>
                  <Text style={styles.placeSubtitle}>
                    See and be seen by people near your travel cities.
                  </Text>
                </View>
                <Switch
                  value={state.travelMode}
                  onValueChange={toggleTravelMode}
                  disabled={isTogglingTravel}
                  trackColor={{ true: colors.primary, false: colors.border }}
                />
              </View>
            </View>

            {state.secondary.map(place => (
              <View key={place.id} style={styles.card}>
                <View style={styles.row}>
                  <View style={styles.iconWrap}>
                    <IIcon
                      name="airplane-outline"
                      size={18}
                      color={colors.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.placeTitle}>{placeTitle(place)}</Text>
                    {!!known(place.country) && (
                      <Text style={styles.placeSubtitle}>
                        {known(place.country)}
                      </Text>
                    )}
                  </View>
                  <Pressable
                    onPress={() => removePlace(place)}
                    disabled={removingId === place.id}
                    hitSlop={8}
                    accessibilityLabel={`Remove ${placeTitle(place)}`}
                  >
                    {removingId === place.id ? (
                      <ActivityIndicator size="small" color={colors.danger} />
                    ) : (
                      <IIcon
                        name="trash-outline"
                        size={18}
                        color={colors.danger}
                      />
                    )}
                  </Pressable>
                </View>
              </View>
            ))}

            {isSearchOpen ? (
              <View style={styles.card}>
                <View style={styles.searchRow}>
                  <IIcon name="search" size={16} color={colors.textTertiary} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search for a city"
                    placeholderTextColor={colors.textTertiary}
                    value={query}
                    onChangeText={setQuery}
                    autoFocus
                    autoCorrect={false}
                    returnKeyType="search"
                  />
                  <Pressable
                    onPress={() => {
                      setIsSearchOpen(false);
                      setQuery('');
                    }}
                    hitSlop={8}
                  >
                    <IIcon
                      name="close"
                      size={18}
                      color={colors.textSecondary}
                    />
                  </Pressable>
                </View>
                {isSearching ? (
                  <ActivityIndicator
                    style={{ marginVertical: 12 }}
                    color={colors.primary}
                  />
                ) : query.trim().length >= 2 && results.length === 0 ? (
                  <Text style={[styles.hint, { marginTop: 10 }]}>
                    No cities found.
                  </Text>
                ) : (
                  results.map((place, index) => {
                    // the geocoder can return different places with identical coordinates
                    const key = `${index}:${place.latd},${place.long}`;
                    return (
                      <Pressable
                        key={key}
                        style={styles.resultRow}
                        onPress={() => addPlace(place, key)}
                        disabled={addingKey !== null}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.placeTitle}>
                            {placeTitle(place)}
                          </Text>
                          {!!known(place.country) && (
                            <Text style={styles.placeSubtitle}>
                              {known(place.country)}
                            </Text>
                          )}
                        </View>
                        {addingKey === key ? (
                          <ActivityIndicator
                            size="small"
                            color={colors.primary}
                          />
                        ) : (
                          <IIcon
                            name="add-circle-outline"
                            size={20}
                            color={colors.primary}
                          />
                        )}
                      </Pressable>
                    );
                  })
                )}
              </View>
            ) : canAddMore ? (
              <Pressable
                style={styles.addButton}
                onPress={() => setIsSearchOpen(true)}
              >
                <IIcon name="add" size={18} color={colors.primary} />
                <Text style={styles.addButtonText}>
                  Add a city ({state.secondary.length}/{state.maxSecondary})
                </Text>
              </Pressable>
            ) : (
              <Text style={styles.hint}>
                You've added the maximum of {state.maxSecondary} travel cities.
                Remove one to add another.
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.backgroundSecondary },
    headerTitle: { fontSize: 18, fontWeight: '900', color: colors.text },
    scrollContent: { padding: 18, gap: 10, paddingBottom: 40 },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 18,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.textTertiary,
    },
    vipBadge: {
      backgroundColor: colors.primary,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    vipBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900' },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      gap: 12,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundSecondary,
    },
    placeTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
    placeSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    hint: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
    lockedText: { flex: 1 },
    refreshButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundSecondary,
    },
    primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 46,
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
    primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      height: 48,
      borderRadius: 18,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.primary,
    },
    addButtonText: { color: colors.primary, fontSize: 15, fontWeight: '800' },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 12,
      paddingHorizontal: 12,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 10,
      fontSize: 15,
      color: colors.text,
    },
    resultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 8,
    },
  });
}
