import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Linking, Animated } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import IIcon from 'react-native-vector-icons/Ionicons';
import { _http_request, cacheStorage, help, hostServer, parseCategoryProducts } from '../funcs/functions';
import { Loaderx, bottomsheet_renderBackdrop } from '../funcs/functions_stateful';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { SafeAreaView } from 'react-native-safe-area-context';
import { namer, styles } from '../funcs/static';

const TIER_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

// Helper functions remain the same
const normalizePayload = (payload: any) => {
  if (!payload || typeof payload !== 'object') return null;
  if (typeof payload === 'object') return payload;
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
};

const extractFeatureText = (feature: any): string | null => {
  if (typeof feature === 'string') return feature.trim() || null;
  if (!feature || typeof feature !== 'object') return null;
  const isEnabled = feature?.e ?? feature?.enabled ?? true;
  const text = feature?.d ?? feature?.description ?? feature?.text ?? '';
  return isEnabled && typeof text === 'string' ? text.trim() || null : null;
};

const extractFeaturesFromTierItem = (tierItem: any): string[] => {
  if (tierItem?.description?.features && Array.isArray(tierItem.description.features)) {
    const features = tierItem.description.features
      .map(extractFeatureText)
      .filter(Boolean) as string[];
    if (features.length) return features;
  }

  const metaData = normalizePayload(tierItem?.meta_data);
  if (metaData?.features && Array.isArray(metaData.features)) {
    const features = metaData.features
      .map(extractFeatureText)
      .filter(Boolean) as string[];
    if (features.length) return features;
  }

  return [];
};

const getCycleLabel = (variant: any): string => {
  if (variant?.metadata?.cycle) {
    const cycle = variant.metadata.cycle.trim();
    if (cycle) return cycle;
  }

  if (variant?.name) {
    const name = variant.name.trim();
    if (name) return name;
  }

  return 'Billing cycle';
};

const formatPrice = (price: any): string => {
  const amount = Number(price);
  return Number.isFinite(amount) ? amount.toFixed(2) : '0.00';
};

const calculateMonthlyEquivalent = (price: number, cycle: string): number => {
  if (cycle.toLowerCase().includes('year')) return price / 12;
  if (cycle.toLowerCase().includes('quarter')) return price / 3;
  if (cycle.toLowerCase().includes('month')) return price;
  return price;
};

export const Screen_PurchaseSubscribe = ({ route, navigation }: { route: any; navigation: any }) => {
  const [profile, setProfile] = useState<any>(null);
  const [products, setProducts] = useState<any>(null);
  const [selectedTier, setSelectedTier] = useState<string>(() => route?.params?.tab || '');
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);
  const [productDetails, setProductDetails] = useState<{ sku: string; variantId?: number } | null>(null);
  const [expandedBenefits, setExpandedBenefits] = useState(false);

  const paymentSheetRef = useRef<BottomSheet>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Load data
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [rawProducts, userProfile] = await Promise.all([
          cacheStorage.getProducts().then(raw => parseCategoryProducts(raw, namer.productCategoryName.mainsub)),
          cacheStorage.getCurrentUserProfile()
        ]);
        if (mounted) {
          setProducts(rawProducts);
          setProfile(userProfile);
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }).start();
        }
      } catch {
        if (mounted) {
          setProducts(null);
          setProfile(null);
        }
      }
    })();
    return () => { mounted = false; };
  }, []);

  const tierKeys = useMemo(() =>
    products?.map((tier: any) => tier.name?.trim()).filter(Boolean) ?? [],
    [products]
  );

  const getTierColor = useCallback((tierKey: string): string => {
    const index = tierKeys.indexOf(tierKey);
    return TIER_COLORS[index >= 0 ? index % TIER_COLORS.length : 0];
  }, [tierKeys]);

  const subscriptionState = help.getSubscriptionState(profile);
  const activeSubscription = subscriptionState.hasActive;
  const userCurrentTier = subscriptionState.plan;

  const getTierKeyByName = useCallback((planName?: string) => {
    if (!planName || !products) return '';
    const normalized = planName.toLowerCase().trim();
    const match = products.find((tier: any) =>
      tier.name?.toLowerCase().trim() === normalized
    );
    return match?.name?.trim() ?? '';
  }, [products]);

  const activeTierKey = activeSubscription ? getTierKeyByName(userCurrentTier) : '';

  // Set initial tier
  useEffect(() => {
    if (!selectedTier) {
      setSelectedTier(activeTierKey || tierKeys[0] || '');
    }
  }, [activeTierKey, tierKeys, selectedTier]);

  const currentTier = products?.find((tier: any) => tier.name?.trim() === selectedTier) || null;
  const currentVariants = currentTier?.variants ?? [];

  const currentTierFeatures = extractFeaturesFromTierItem(currentTier || {});

  // Smart variant selection - pick most popular (usually annual)
  useEffect(() => {
    if (currentVariants.length) {
      const annualVariant = currentVariants.find((v: any) =>
        getCycleLabel(v).toLowerCase().includes('year')
      );
      setSelectedVariantId(annualVariant?.id || currentVariants[0]?.id || null);
    } else {
      setSelectedVariantId(null);
    }
  }, [currentVariants]);

  const selectedVariant = currentVariants.find((v: any) => v.id === selectedVariantId) || currentVariants[0] || null;


  const handleSubscribe = (paymentMethod: 'iap' | 'card') => {
    Loaderx.show();
    if (paymentMethod === 'iap') {
      Loaderx.hide();
      Alert.alert('Info', 'IAP payment method is currently unavailable. Please try the credit card option or contact support.');
      return;
    }
console.log(productDetails?.sku,productDetails)
    if(paymentMethod === 'card') {
    _http_request({
      customApiUrl: `${hostServer()}/api/secure/gateway/subscribe`,
      reqType: 'POST',
      bodyArray: {
        s_sku: productDetails?.sku,
        s_duration_int: productDetails?.variantId,
      }
    }).then((fg: any) => {
      Loaderx.hide();
      if (fg?.code === 301 && fg?.type === "external" && fg?.url) {
        Linking.openURL(fg.url).catch(() => {
          Alert.alert('Payment Error', 'Unable to open payment page. Please try again.');
        });
      } else {
        Alert.alert('Payment Error', fg?.message ?? 'There has been an error.');
      }
    });
    }
  };

  const openPaymentSheet = () => {
    if (!selectedVariantId || !selectedVariant) return;
    paymentSheetRef.current?.snapToIndex(0);
  };

  const visibleFeatures = expandedBenefits ? currentTierFeatures : currentTierFeatures.slice(0, 4);

  return (
    <LinearGradient colors={['#0f0b14', '#171126', '#0f111a']}>
      <SafeAreaView edges={['bottom']}>
        <Animated.ScrollView
          contentContainerStyle={[styles.conainerScrollView, { paddingVertical: 25 }]}
          showsVerticalScrollIndicator={false}
          style={{ opacity: fadeAnim }}>
          {/* Hero Section */}
          <View style={styles2.heroSection}>
            <Text style={styles2.heroTitle}>Choose your plan</Text>
            <Text style={styles2.heroSubtitle}>
              Get access to premium features and priority support
            </Text>
          </View>

          {/* Tier Selection - Horizontal Scroll for better mobile UX */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles2.tierScrollContainer, { flex: 1 }]}
          >
            {tierKeys.map((tierKey: any) => {
              const tierData = products?.find((tier: any) => tier.name?.trim() === tierKey);
              const tierIndex = tierKeys.indexOf(tierKey);
              const tierColor = TIER_COLORS[tierIndex >= 0 ? tierIndex % TIER_COLORS.length : 0];
              const isSelected = selectedTier === tierKey;
              const isActive = activeSubscription && activeTierKey === tierKey;
              const tierFeatures = extractFeaturesFromTierItem(tierData || {});

              // Get the most attractive feature
              const highlightFeature = tierFeatures[0] || 'Full access';

              return (
                <TouchableOpacity
                  key={tierKey}
                  activeOpacity={0.5}
                  disabled={isActive}
                  onPress={() => setSelectedTier(tierKey)}
                  style={[
                    styles2.tierCard,
                    { borderColor: tierColor },
                    isSelected && {
                      backgroundColor: `${tierColor}aa`,
                      borderWidth: 2,
                      shadowColor: tierColor,
                      shadowOpacity: 0.3,
                      shadowRadius: 12,
                    },
                    { flex: 1 },
                    isActive && styles2.tierCardDisabled,
                  ]}
                >
                  <View style={styles2.tierHeader}>
                    <Text style={[styles2.tierName, { color: tierColor, textTransform: "uppercase" }]}>
                      {tierKey}
                    </Text>
                    {isActive && (
                      <View style={[styles2.badge, { backgroundColor: tierColor }]}>
                        <IIcon name="checkmark-circle" size={12} color="#fff" />
                        <Text style={styles2.badgeText}>Active</Text>
                      </View>
                    )}
                    {!isActive && isSelected && (
                      <View style={[styles2.badge, { backgroundColor: tierColor }]}>
                        <Text style={styles2.badgeText}>Selected</Text>
                      </View>
                    )}
                  </View>


                  <View style={styles2.tierFooter}>
                    <Text style={styles2.tierPrice}>
                      From ${formatPrice(tierData?.variants?.[0]?.price || 0)}
                    </Text>
                    <IIcon name="chevron-forward" size={16} color={tierColor} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Benefits Section - Collapsible */}
          <View style={styles2.section}>
            <TouchableOpacity
              style={styles2.sectionHeader}
              onPress={() => setExpandedBenefits(!expandedBenefits)}
              activeOpacity={0.7}
            >
              <View style={styles2.sectionHeaderLeft}>
                <IIcon name="gift-outline" size={22} color={getTierColor(selectedTier)} />
                <Text style={styles2.sectionTitle}>What's included</Text>
              </View>
              <IIcon
                name={expandedBenefits ? "chevron-up" : "chevron-down"}
                size={20}
                color="#9ca3af"
              />
            </TouchableOpacity>

            <View style={styles2.benefitList}>
              {visibleFeatures.length === 0 ? (
                <Text style={styles2.emptyBenefit}>Benefits coming soon.</Text>
              ) : (
                visibleFeatures.map((benefit, index) => (
                  <Animated.View key={index} style={styles2.benefitItem}>
                    <View style={[styles2.benefitIcon, { backgroundColor: getTierColor(selectedTier) }]}>
                      <IIcon name="checkmark" size={14} color="#fff" />
                    </View>
                    <Text style={styles2.benefitText}>{benefit}</Text>
                  </Animated.View>
                ))
              )}

              {currentTierFeatures.length > 4 && !expandedBenefits && (
                <TouchableOpacity
                  style={styles2.showMoreButton}
                  onPress={() => setExpandedBenefits(true)}
                >
                  <Text style={[styles2.showMoreText, { color: getTierColor(selectedTier) }]}>
                    +{currentTierFeatures.length - 4} more benefits
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Billing Cycles - Grid Layout with better visual hierarchy */}
          <View style={styles2.section}>
            <View style={styles2.sectionHeader}>
              <View style={styles2.sectionHeaderLeft}>
                <IIcon name="calendar-outline" size={22} color={getTierColor(selectedTier)} />
                <Text style={styles2.sectionTitle}>Billing cycle</Text>
              </View>
              <Text style={styles2.sectionSubtitle}>Cancel anytime</Text>
            </View>

            <View style={styles2.cycleGrid}>
              {currentVariants.map((variant: any) => {
                const isSelected = selectedVariantId === variant.id;
                const tierColor = getTierColor(selectedTier);
                const cycleLabel = getCycleLabel(variant);
                const price = Number(variant.price);
                const monthlyEquivalent = calculateMonthlyEquivalent(price, cycleLabel);
                const savings = monthlyEquivalent > 0 && cycleLabel.toLowerCase().includes('year')
                  ? Math.round(((monthlyEquivalent * 12 - price) / (monthlyEquivalent * 12)) * 100)
                  : 0;
                const isBestValue = savings >= 20;

                return (
                  <TouchableOpacity
                    key={variant.id}
                    onPress={() => {
                      console.log('currentTier', currentTier);
                      setSelectedVariantId(variant.id);
                      setProductDetails({
                        sku: currentTier?.sku,
                        variantId: variant.id,
                      });
                    }}
                    style={[
                      styles2.cycleCard,
                      isSelected && [styles2.cycleCardSelected, { borderColor: tierColor }],
                    ]}
                    activeOpacity={0.7}
                  >
                    {isBestValue && (
                      <View style={[styles2.bestValueBadge, { backgroundColor: tierColor }]}>
                        <Text style={styles2.bestValueText}>Best Value</Text>
                      </View>
                    )}

                    <View style={styles2.cycleCardContent}>
                      <View style={styles2.cycleCardHeader}>
                        <Text style={[styles2.cycleLabel, isSelected && { color: tierColor }]}>
                          {cycleLabel}
                        </Text>
                        {isSelected && (
                          <View style={[styles2.selectedIndicator, { backgroundColor: tierColor }]}>
                            <IIcon name="checkmark" size={12} color="#fff" />
                          </View>
                        )}
                      </View>

                      <Text style={styles2.cyclePrice}>
                        ${formatPrice(price)}
                        <Text style={styles2.cyclePeriod}>/{cycleLabel.toLowerCase()}</Text>
                      </Text>

                      {monthlyEquivalent > 0 && !cycleLabel.toLowerCase().includes('month') && (
                        <Text style={styles2.monthlyEquivalentText}>
                          ~${monthlyEquivalent.toFixed(2)}/month
                        </Text>
                      )}

                      {savings > 0 && (
                        <View style={styles2.savingsContainer}>
                          <IIcon name="trending-down" size={14} color="#10b981" />
                          <Text style={styles2.savingsText}>Save {savings}%</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Price Summary Card */}
          {selectedVariant && (
            <View style={styles2.summaryCard}>
              <View style={styles2.summaryRow}>
                <Text style={styles2.summaryLabel}>Selected plan</Text>
                <Text style={styles2.summaryValue}>{selectedTier}</Text>
              </View>
              <View style={styles2.summaryRow}>
                <Text style={styles2.summaryLabel}>Billing cycle</Text>
                <Text style={styles2.summaryValue}>{getCycleLabel(selectedVariant)}</Text>
              </View>
              <View style={[styles2.summaryRow, styles2.summaryTotal]}>
                <Text style={styles2.summaryTotalLabel}>Total</Text>
                <Text style={[styles2.summaryTotalValue, { color: getTierColor(selectedTier) }]}>
                  ${formatPrice(selectedVariant.price)}
                </Text>
              </View>
            </View>
          )}

          {/* Primary CTA Button */}
          {selectedVariant && (
            <TouchableOpacity
              style={[styles2.subscribeButton, { backgroundColor: getTierColor(selectedTier) }]}
              onPress={openPaymentSheet}
              activeOpacity={0.8}
            >
              <Text style={styles2.subscribeButtonText}>
                Continue to payment
              </Text>
              <IIcon name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>
          )}

          {/* Trust Indicators */}
          <View style={styles2.trustSection}>
            <View style={styles2.trustItem}>
              <IIcon name="lock-closed" size={16} color="#6b7280" />
              <Text style={styles2.trustText}>Secure payment</Text>
            </View>
            <View style={styles2.trustItem}>
              <IIcon name="refresh" size={16} color="#6b7280" />
              <Text style={styles2.trustText}>Cancel anytime</Text>
            </View>
            <View style={styles2.trustItem}>
              <IIcon name="headset" size={16} color="#6b7280" />
              <Text style={styles2.trustText}>24/7 support</Text>
            </View>
          </View>

          <Text style={styles2.disclaimer}>
            By continuing, you agree to our Terms of Service and Privacy Policy.
            Your subscription will automatically renew unless canceled at least 24 hours before the renewal date.
          </Text>
        </Animated.ScrollView>
      </SafeAreaView>
      {/* Redesigned Payment Sheet */}
      <BottomSheet
        ref={paymentSheetRef}
        index={-1}
        enablePanDownToClose
        snapPoints={[]}
        backdropComponent={bottomsheet_renderBackdrop}
      >
        <BottomSheetView style={styles.container}>
          <SafeAreaView edges={['bottom']}>
            <View style={styles2.sheetHeader}>
              <Text style={styles2.sheetTitle}>Complete payment</Text>
              <TouchableOpacity onPress={() => paymentSheetRef.current?.close()}>
                <IIcon name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View style={[styles2.orderSummary, { borderColor: getTierColor(selectedTier) }]}>
              <Text style={styles2.orderSummaryTitle}>Order summary</Text>
              <View style={styles2.orderSummaryRow}>
                <Text style={styles2.orderSummaryLabel}>{selectedTier} Plan</Text>
                <Text style={styles2.orderSummaryValue}>
                  {getCycleLabel(selectedVariant)}
                </Text>
              </View>
              <View style={[styles2.orderSummaryRow, styles2.orderSummaryTotal]}>
                <Text style={styles2.orderSummaryTotalLabel}>Total due today</Text>
                <Text style={[styles2.orderSummaryTotalValue, { color: getTierColor(selectedTier) }]}>
                  ${formatPrice(selectedVariant?.price)}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles2.sheetButton, styles2.sheetButtonPrimary]}
              onPress={() => handleSubscribe('card')}
            >
              <IIcon name="card-outline" size={20} color="#fff" />
              <Text style={styles2.sheetButtonTextPrimary}>Credit / Debit card</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles2.sheetButton, styles2.sheetButtonSecondary]}
              onPress={() => handleSubscribe('iap')}
            >
              <IIcon name="logo-apple" size={20} color="#111827" />
              <Text style={styles2.sheetButtonTextSecondary}>Apple Pay</Text>
            </TouchableOpacity>

            <Text style={styles2.sheetDisclaimer}>
              You will not be charged until you confirm the payment
            </Text>
          </SafeAreaView>
        </BottomSheetView>
      </BottomSheet>
    </LinearGradient>
  );
};

const styles2 = StyleSheet.create({
  scrollContainer: { padding: 20, paddingBottom: 40 },

  // Hero section
  heroSection: { marginBottom: 28, alignItems: 'center' },
  heroTitle: { color: '#fff', fontSize: 28, fontWeight: '800', marginBottom: 8 },
  heroSubtitle: { color: '#9ca3af', fontSize: 14, textAlign: 'center', lineHeight: 20 },

  // Tier selection styles
  tierScrollContainer: { paddingHorizontal: 4, gap: 12, marginBottom: 28 },
  tierCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    backgroundColor: 'rgba(255,255,255,0.03)',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  tierCardDisabled: { opacity: 0.45 },
  tierHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  tierName: { fontSize: 18, fontWeight: '800' },
  tierHighlight: { color: '#e5e7eb', fontSize: 13, marginBottom: 12, lineHeight: 18 },
  tierFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' },
  tierPrice: { color: '#9ca3af', fontSize: 13, fontWeight: '600' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 20 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  // Section styles
  section: { marginBottom: 28 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  sectionSubtitle: { color: '#6b7280', fontSize: 12 },

  // Benefits styles
  benefitList: { borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.03)', padding: 16 },
  benefitItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  benefitIcon: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  benefitText: { color: '#e5e7eb', fontSize: 14, flex: 1, lineHeight: 20 },
  emptyBenefit: { color: '#9ca3af', fontSize: 14, textAlign: 'center', padding: 20 },
  showMoreButton: { alignItems: 'center', paddingTop: 12, marginTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  showMoreText: { fontSize: 13, fontWeight: '600' },

  // Billing cycle styles
  cycleGrid: { gap: 12 },
  cycleCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#2f3040',
    backgroundColor: 'rgba(255,255,255,0.02)',
    position: 'relative',
  },
  cycleCardSelected: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  bestValueBadge: {
    position: 'absolute',
    top: -1,
    right: -1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderBottomLeftRadius: 12,
    zIndex: 1,
  },
  bestValueText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  cycleCardContent: { gap: 8 },
  cycleCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cycleLabel: { fontSize: 16, fontWeight: '700', color: '#e5e7eb' },
  selectedIndicator: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cyclePrice: { fontSize: 24, fontWeight: '800', color: '#fff' },
  cyclePeriod: { fontSize: 14, fontWeight: '400', color: '#9ca3af' },
  monthlyEquivalentText: { fontSize: 12, color: '#6b7280' },
  savingsContainer: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  savingsText: { fontSize: 12, fontWeight: '600', color: '#10b981' },

  // Summary card
  summaryCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  summaryLabel: { color: '#9ca3af', fontSize: 14 },
  summaryValue: { color: '#fff', fontSize: 14, fontWeight: '600' },
  summaryTotal: { marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  summaryTotalLabel: { color: '#fff', fontSize: 16, fontWeight: '700' },
  summaryTotalValue: { fontSize: 20, fontWeight: '800' },

  // CTA Button
  subscribeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 24,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  subscribeButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Trust indicators
  trustSection: { flexDirection: 'row', justifyContent: 'center', gap: 24, marginBottom: 20 },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trustText: { color: '#6b7280', fontSize: 12 },

  disclaimer: { color: '#6b7280', fontSize: 11, lineHeight: 16, textAlign: 'center' },

  // Bottom sheet styles 
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  orderSummary: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    backgroundColor: '#f9fafb',
  },
  orderSummaryTitle: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 12 },
  orderSummaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  orderSummaryLabel: { color: '#6b7280', fontSize: 13 },
  orderSummaryValue: { color: '#111827', fontSize: 13, fontWeight: '500' },
  orderSummaryTotal: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  orderSummaryTotalLabel: { fontSize: 14, fontWeight: '700', color: '#111827' },
  orderSummaryTotalValue: { fontSize: 18, fontWeight: '800' },
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
  sheetButtonSecondary: { backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
  sheetButtonTextPrimary: { color: '#fff', fontSize: 15, fontWeight: '700' },
  sheetButtonTextSecondary: { color: '#111827', fontSize: 15, fontWeight: '700' },
  sheetDisclaimer: { textAlign: 'center', color: '#9ca3af', fontSize: 12, marginTop: 16 },
}); 
