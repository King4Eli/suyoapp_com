import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
  Animated,
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import IIcon from 'react-native-vector-icons/Ionicons';
import {
  _http_request,
  cacheStorage,
  help,
  parseCategoryProducts,
} from '../funcs/functions';
import {
  Loaderx,
  bottomsheet_renderBackdrop,
} from '../funcs/functions_stateful';
import { purchaseNative } from '../funcs/iap';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { SafeAreaView } from 'react-native-safe-area-context';
import { namer, styles, __CONFIG__ } from '../funcs/static';

// Brand-family tier accents (rose -> plum -> gold -> aubergine) so the paywall
// reads as the same product as the rest of the app.
const TIER_COLORS = ['#F0577A', '#B23FA0', '#C99A3E', '#6E4B8E'];

const extractFeatureText = (feature: any): string | null => {
  if (typeof feature === 'string') return feature.trim() || null;
  if (!feature || typeof feature !== 'object') return null;
  const isEnabled = feature?.e ?? feature?.enabled ?? true;
  const text = feature?.d ?? feature?.description ?? feature?.text ?? '';
  return isEnabled && typeof text === 'string' ? text.trim() || null : null;
};

const getFeatures = (tier: any): string[] =>
  Array.isArray(tier?.description?.features)
    ? (tier.description.features
        .map(extractFeatureText)
        .filter(Boolean) as string[])
    : [];

const getCycleLabel = (variant: any): string =>
  String(variant?.metadata?.cycle || variant?.name || 'Plan').trim();

const formatPrice = (price: any): string => {
  const amount = Number(price);
  return Number.isFinite(amount) ? amount.toFixed(2) : '0.00';
};

export const Screen_PurchaseSubscribe = ({
  route,
}: {
  route: any;
  navigation: any;
}) => {
  const [profile, setProfile] = useState<any>(null);
  const [products, setProducts] = useState<any[] | null>(null);
  const [selectedTier, setSelectedTier] = useState<string>(
    () => route?.params?.tab || '',
  );
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(
    null,
  );

  const paymentSheetRef = useRef<BottomSheet>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [tiers, userProfile] = await Promise.all([
          cacheStorage
            .getProducts()
            .then(raw =>
              parseCategoryProducts(raw, namer.productCategoryName.mainsub),
            ),
          cacheStorage.getCurrentUserProfile(),
        ]);
        if (mounted) {
          setProducts(Array.isArray(tiers) ? tiers : []);
          setProfile(userProfile);
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }).start();
        }
      } catch {
        if (mounted) setProducts([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [fadeAnim]);

  const tierKeys: string[] = useMemo(
    () =>
      (products ?? [])
        .map((tier: any) => String(tier?.name ?? '').trim())
        .filter(Boolean),
    [products],
  );

  const subscriptionState = help.getSubscriptionState(profile);
  const activeTierKey = subscriptionState.hasActive
    ? tierKeys.find(
        key =>
          key.toLowerCase() ===
          String(subscriptionState.plan ?? '')
            .trim()
            .toLowerCase(),
      ) ?? ''
    : '';

  useEffect(() => {
    if (!selectedTier && tierKeys.length) {
      setSelectedTier(
        tierKeys.find(key => key !== activeTierKey) ?? tierKeys[0],
      );
    }
  }, [activeTierKey, tierKeys, selectedTier]);

  const currentTier =
    products?.find((tier: any) => tier?.name?.trim() === selectedTier) ?? null;
  const variants: any[] = useMemo(
    () => currentTier?.variants ?? [],
    [currentTier],
  );
  const features = getFeatures(currentTier);
  const tierColor =
    TIER_COLORS[
      Math.max(0, tierKeys.indexOf(selectedTier)) % TIER_COLORS.length
    ];
  const isCurrentPlan = !!activeTierKey && selectedTier === activeTierKey;

  useEffect(() => {
    setSelectedVariantId(variants[0]?.id ?? null);
  }, [variants]);

  const selectedVariant =
    variants.find((v: any) => v.id === selectedVariantId) ?? null;

  const handleSubscribe = async (paymentMethod: 'iap' | 'card') => {
    if (!currentTier?.sku || !selectedVariant) {
      Alert.alert('Error', 'Please select a plan first.');
      return;
    }

    Loaderx.show();
    if (paymentMethod === 'iap') {
      const result = await purchaseNative({
        purchaseType: 'subscribe',
        sku: currentTier.sku,
        variantId: selectedVariant.id,
        storeProductId: selectedVariant.store_product_id,
      });
      Loaderx.hide();
      if (result.code === 200) {
        paymentSheetRef.current?.close();
        Alert.alert('Success', 'Your subscription is now active.');
      } else if (result.code !== 499) {
        Alert.alert(
          'Payment Error',
          result.message ?? 'There has been an error.',
        );
      }
      return;
    }

    const res: any = await _http_request({
      customApiUrl: `${__CONFIG__.HTTPS_API_DOMAIN}/api/secure/gateway/subscribe`,
      reqType: 'POST',
      bodyArray: { s_sku: currentTier.sku, s_duration_int: selectedVariant.id },
    });
    Loaderx.hide();
    if (res?.code === 301 && res?.type === 'external' && res?.url) {
      Linking.openURL(res.url).catch(() => {
        Alert.alert(
          'Payment Error',
          'Unable to open payment page. Please try again.',
        );
      });
    } else {
      Alert.alert('Payment Error', res?.message ?? 'There has been an error.');
    }
  };

  const priceLabel = selectedVariant
    ? `$${formatPrice(selectedVariant.price)} / ${getCycleLabel(
        selectedVariant,
      ).toLowerCase()}`
    : '';

  return (
    <LinearGradient colors={['#1A1420', '#141018']} style={{ flex: 1 }}>
      <SafeAreaView edges={['bottom']} style={{ flex: 1 }}>
        <Animated.ScrollView
          contentContainerStyle={[
            styles.conainerScrollView,
            { paddingVertical: 25 },
          ]}
          showsVerticalScrollIndicator={false}
          style={{ opacity: fadeAnim }}
        >
          <Text style={s.title}>Choose your plan</Text>

          {/* Tier toggle */}
          <View style={s.segment}>
            {tierKeys.map(tierKey => {
              const isSelected = tierKey === selectedTier;
              return (
                <TouchableOpacity
                  key={tierKey}
                  style={[
                    s.segmentItem,
                    isSelected && { backgroundColor: tierColor },
                  ]}
                  onPress={() => setSelectedTier(tierKey)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[s.segmentText, isSelected && s.segmentTextActive]}
                  >
                    {tierKey}
                  </Text>
                  {tierKey === activeTierKey && (
                    <Text
                      style={[
                        s.segmentCurrent,
                        isSelected && s.segmentTextActive,
                      ]}
                    >
                      Current
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Features */}
          <View style={s.features}>
            {features.length === 0 ? (
              <Text style={s.muted}>Benefits coming soon.</Text>
            ) : (
              features.map((feature, index) => (
                <View key={index} style={s.featureRow}>
                  <IIcon name="checkmark" size={18} color={tierColor} />
                  <Text style={s.featureText}>{feature}</Text>
                </View>
              ))
            )}
          </View>

          {/* Billing options */}
          {!isCurrentPlan && (
            <View style={s.options}>
              {variants.map((variant: any) => {
                const isSelected = variant.id === selectedVariantId;
                const discount = String(
                  variant?.metadata?.discount ?? '',
                ).trim();
                return (
                  <TouchableOpacity
                    key={variant.id}
                    style={[s.option, isSelected && { borderColor: tierColor }]}
                    onPress={() => setSelectedVariantId(variant.id)}
                    activeOpacity={0.8}
                  >
                    <IIcon
                      name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={isSelected ? tierColor : '#6b7280'}
                    />
                    <Text style={s.optionLabel}>{getCycleLabel(variant)}</Text>
                    {!!discount && (
                      <Text style={[s.optionDiscount, { color: tierColor }]}>
                        {discount}
                      </Text>
                    )}
                    <Text style={s.optionPrice}>
                      ${formatPrice(variant.price)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <TouchableOpacity
            style={[
              s.cta,
              { backgroundColor: tierColor },
              (isCurrentPlan || !selectedVariant) && s.ctaDisabled,
            ]}
            disabled={isCurrentPlan || !selectedVariant}
            onPress={() => paymentSheetRef.current?.snapToIndex(0)}
            activeOpacity={0.85}
          >
            <Text style={s.ctaText}>
              {isCurrentPlan
                ? 'Your current plan'
                : selectedVariant
                ? `Continue · $${formatPrice(selectedVariant.price)}`
                : 'Continue'}
            </Text>
          </TouchableOpacity>

          <Text style={s.footnote}>Renews automatically. Cancel anytime.</Text>
        </Animated.ScrollView>
      </SafeAreaView>

      <BottomSheet
        ref={paymentSheetRef}
        index={-1}
        enablePanDownToClose
        snapPoints={[]}
        backdropComponent={bottomsheet_renderBackdrop}
      >
        <BottomSheetView style={styles.container}>
          <SafeAreaView edges={['bottom']}>
            <Text style={s.sheetTitle}>
              {selectedTier} · {priceLabel}
            </Text>

            <TouchableOpacity
              style={[s.sheetButton, s.sheetButtonPrimary]}
              onPress={() => handleSubscribe('card')}
            >
              <IIcon name="card-outline" size={20} color="#fff" />
              <Text style={s.sheetButtonTextPrimary}>Pay with card</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.sheetButton, s.sheetButtonSecondary]}
              onPress={() => handleSubscribe('iap')}
            >
              <IIcon
                name={
                  Platform.OS === 'ios' ? 'logo-apple' : 'logo-google-playstore'
                }
                size={20}
                color="#111827"
              />
              <Text style={s.sheetButtonTextSecondary}>
                {Platform.OS === 'ios' ? 'Apple Pay' : 'Google Play'}
              </Text>
            </TouchableOpacity>
          </SafeAreaView>
        </BottomSheetView>
      </BottomSheet>
    </LinearGradient>
  );
};

const s = StyleSheet.create({
  title: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 20,
  },

  segment: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 4,
    marginBottom: 24,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 11,
  },
  segmentText: {
    color: '#9ca3af',
    fontSize: 15,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  segmentTextActive: { color: '#fff' },
  segmentCurrent: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },

  features: { gap: 12, marginBottom: 24, paddingHorizontal: 4 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureText: { color: '#e5e7eb', fontSize: 15, flex: 1 },
  muted: { color: '#9ca3af', fontSize: 14, textAlign: 'center' },

  options: { gap: 10, marginBottom: 20 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  optionLabel: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  optionDiscount: { fontSize: 12, fontWeight: '800' },
  optionPrice: { color: '#fff', fontSize: 16, fontWeight: '800' },

  cta: {
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  footnote: { color: '#6b7280', fontSize: 12, textAlign: 'center' },

  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    textTransform: 'capitalize',
    marginBottom: 20,
  },
  sheetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 12,
  },
  sheetButtonPrimary: { backgroundColor: '#111827' },
  sheetButtonSecondary: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sheetButtonTextPrimary: { color: '#fff', fontSize: 15, fontWeight: '700' },
  sheetButtonTextSecondary: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '700',
  },
});
