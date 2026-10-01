import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { Dialogx } from '../funcs/customDialog';
import LinearGradient from '../funcs/customGradient';
import Icon from 'react-native-vector-icons/Ionicons';
import { cacheStorage, parseCategoryProducts } from '../funcs/functions';
import { Loaderx } from '../funcs/functions_stateful';
import { purchaseNative } from '../funcs/iap';
import { leavePaymentScreens } from '../funcs/functions/paymentNotices';
import { startWebOnetimeCheckout } from '../funcs/customConsumableSheet';
import { namer, __CONFIG__ } from '../funcs/static';
import { useTheme, ThemeColors } from '../funcs/theme';

// Brand plum used for this screen's accents; reads on both light and dark.
const ACCENT = '#C558B8';
const ACCENT_DARK = '#8A3FA0';

const formatPrice = (price: number): string => price?.toFixed(2) ?? '0.00';

// Calculate savings percentage
const calculateSavings = (price: number, originalPrice?: number): number => {
  if (!originalPrice || originalPrice <= price) return 0;
  return Math.round(((originalPrice - price) / originalPrice) * 100);
};

// Get variant display info
const getVariantInfo = (variant: any) => {
  const cycle = variant?.metadata?.cycle || variant?.name || 'One-time';
  const discount = variant?.metadata?.discount;
  const originalPrice = variant?.metadata?.original_price || variant?.price;
  const savings = discount
    ? parseInt(discount, 10)
    : calculateSavings(variant?.price, originalPrice);

  return { cycle, discount, savings, originalPrice };
};

export const Screen_PurchaseConsumable = ({ route }: any) => {
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(
    null,
  );
  const [showConfirm, setShowConfirm] = useState(false);
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(
    new Set(),
  );
  const [currentRoses, setCurrentRoses] = useState<number | null>(null);

  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  const requestedCategory = route?.params?.productcategory?.trim();
  const productCategory =
    !requestedCategory ||
    requestedCategory === namer.productCategoryName.mainsub
      ? namer.productCategoryName.superlike
      : requestedCategory;
  const isRoseCategory =
    productCategory === namer.productCategoryName.superlike;
  const requestedMatchId = route?.params?.matchId;
  const isRewindCategory = productCategory === namer.productCategoryName.rewind;
  const isDirectMessageCategory =
    productCategory === namer.productCategoryName.directmessage;

  // Load products with animation
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const rawProducts = await cacheStorage.getProducts();
        const parsed = await parseCategoryProducts(
          rawProducts,
          productCategory,
        );
        const productList = Array.isArray(parsed)
          ? parsed
          : parsed?.products && Array.isArray(parsed.products)
          ? parsed.products
          : [];

        if (mounted) {
          setProducts(productList);
          const initial = productList[0] ?? null;
          setSelectedProduct(initial);
          setSelectedVariantId(initial?.variants?.[0]?.id ?? null);

          Animated.parallel([
            Animated.timing(fadeAnim, {
              toValue: 1,
              duration: 500,
              useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
              toValue: 0,
              duration: 500,
              useNativeDriver: true,
            }),
          ]).start();
        }
      } catch {
        if (mounted) setProducts([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [productCategory, fadeAnim, slideAnim]);

  useEffect(() => {
    if (!isRoseCategory) return;
    let mounted = true;
    cacheStorage
      .getCurrentUserProfile()
      .then((profile: any) => {
        if (!mounted) return;
        const roses = profile?.roses;
        if (roses) setCurrentRoses(roses.remainingToday + roses.balance);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [isRoseCategory]);

  const handlePurchase = () => {
    if (!selectedProduct) return;

    const selectedVariant =
      selectedProduct.variants?.find((v: any) => v.id === selectedVariantId) ||
      selectedProduct.variants?.[0] ||
      null;
    const variantId = selectedVariant?.id || null;

    if (!variantId) return;
    startWebOnetimeCheckout({
      sku: selectedProduct.sku,
      variantId,
      matchId: requestedMatchId,
    }).then(ok => {
      if (ok) setShowConfirm(false);
    });
  };

  const handleNativePurchase = async () => {
    if (!selectedProduct) return;

    const selectedVariant =
      selectedProduct.variants?.find((v: any) => v.id === selectedVariantId) ||
      selectedProduct.variants?.[0] ||
      null;
    if (!selectedVariant) return;

    Loaderx.show();
    const result = await purchaseNative({
      purchaseType: 'onetime',
      sku: selectedProduct.sku,
      variantId: selectedVariant.id,
      storeProductId: selectedVariant.store_product_id,
      ...(requestedMatchId ? { matchId: requestedMatchId } : {}),
    });
    Loaderx.hide();

    if (result.code === 200) {
      setShowConfirm(false);
      leavePaymentScreens();
      Dialogx.alert(
        'Purchase complete',
        'Your purchase was added to your account.',
        undefined,
        {
          tone: 'success',
          icon: 'gift',
        },
      );
    } else if (result.code !== 499) {
      Dialogx.alert(
        "Purchase didn't go through",
        result.message ?? 'Please try again. You have not been charged.',
        undefined,
        { tone: 'error' },
      );
    }
  };

  const toggleProductExpand = (sku: string) => {
    const newExpanded = new Set(expandedProducts);
    if (newExpanded.has(sku)) {
      newExpanded.delete(sku);
    } else {
      newExpanded.add(sku);
    }
    setExpandedProducts(newExpanded);
  };

  // Quick purchase without confirmation modal
  const quickPurchase = (product: any, variantId: number) => {
    setSelectedProduct(product);
    setSelectedVariantId(variantId);
    handlePurchase();
  };

  const VariantCard = ({
    variant,
    product,
    isSelected,
    onSelect,
    showQuickBuy = false,
  }: any) => {
    const { cycle, discount, savings, originalPrice } = getVariantInfo(variant);
    const price = variant?.price || 0;
    const isPopular = cycle.toLowerCase().includes('popular') || savings >= 30;

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => onSelect(variant.id)}
        style={[styles.variantCard, isSelected && styles.variantCardSelected]}
      >
        {isPopular && (
          <View
            style={[
              styles.popularBadge,
              isSelected && styles.popularBadgeSelected,
            ]}
          >
            <Icon name="flame" size={12} color="#fff" />
            <Text style={styles.popularText}>Most Popular</Text>
          </View>
        )}

        {discount && (
          <View
            style={[
              styles.discountBadge,
              isSelected && styles.discountBadgeSelected,
            ]}
          >
            <Text style={styles.discountText}>-{discount}%</Text>
          </View>
        )}

        <View style={styles.variantCardContent}>
          <View style={{ margin: 6 }} />

          <View style={styles.priceContainer}>
            <Text
              style={[
                styles.variantPrice,
                isSelected && styles.variantPriceSelected,
              ]}
            >
              ${formatPrice(price)}
            </Text>
            {originalPrice > price && (
              <Text style={styles.originalPrice}>
                ${formatPrice(originalPrice)}
              </Text>
            )}
          </View>

          {showQuickBuy && !isSelected && (
            <TouchableOpacity
              style={[styles.quickBuyButton, { borderColor: ACCENT }]}
              onPress={() => quickPurchase(product, variant.id)}
            >
              <Text style={styles.quickBuyText}>Buy Now</Text>
            </TouchableOpacity>
          )}
        </View>

        {isSelected && (
          <View style={styles.selectedIndicator}>
            <Icon name="checkmark-circle" size={28} color={ACCENT} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const ProductCard = ({ product }: { product: any }) => {
    const isSelected = selectedProduct?.sku === product.sku;
    const variants = Array.isArray(product.variants) ? product.variants : [];
    const features =
      product?.description?.features?.filter((f: any) => f?.d?.trim()) || [];
    const isExpanded = expandedProducts.has(product.sku);
    const displayFeatures = isExpanded ? features : features.slice(0, 3);
    const hasMoreFeatures = features.length > 3;

    return (
      <Animated.View
        style={[
          styles.productCard,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Product Header with Icon */}
        <View style={styles.productCardHeader}>
          <LinearGradient
            colors={[ACCENT, ACCENT_DARK]}
            style={styles.productIconContainer}
          >
            <Icon
              name={
                isRoseCategory
                  ? 'rose'
                  : isRewindCategory
                  ? 'arrow-undo'
                  : isDirectMessageCategory
                  ? 'chatbubble-ellipses'
                  : 'flash'
              }
              size={24}
              color="#FFF"
            />
          </LinearGradient>
          <View style={styles.productInfo}>
            <Text style={styles.productName}>{product.name}</Text>
            <Text style={styles.productDescription}>
              {product?.description?.short ||
                (isRoseCategory
                  ? 'Spend roses on Super Likes'
                  : isRewindCategory
                  ? 'Recover a match you passed on'
                  : isDirectMessageCategory
                  ? 'Message someone before you match'
                  : 'Boost your profile visibility')}
            </Text>
          </View>
          {features.length > 0 && (
            <View style={styles.featureCount}>
              <Text style={styles.featureCountText}>{features.length}</Text>
              <Icon name="star" size={10} color={ACCENT} />
            </View>
          )}
        </View>

        {/* Features Section - Collapsible */}
        {features.length > 0 && (
          <View style={styles.featuresSection}>
            {displayFeatures.map((feature: any, idx: number) => (
              <View key={idx} style={styles.featureItem}>
                <LinearGradient
                  colors={[ACCENT, ACCENT_DARK]}
                  style={styles.featureIconCircle}
                >
                  <Icon name="checkmark" size={10} color="#FFF" />
                </LinearGradient>
                <Text style={styles.featureText}>{feature.d}</Text>
              </View>
            ))}

            {hasMoreFeatures && (
              <TouchableOpacity
                style={styles.expandButton}
                onPress={() => toggleProductExpand(product.sku)}
              >
                <Text style={styles.expandButtonText}>
                  {isExpanded
                    ? 'Show less'
                    : `+${features.length - 3} more features`}
                </Text>
                <Icon
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={ACCENT}
                />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Variants Grid */}
        <View style={styles.variantsGrid}>
          {variants.map((variant: any) => (
            <VariantCard
              key={variant.id}
              variant={variant}
              product={product}
              isSelected={
                selectedProduct?.sku === product.sku &&
                selectedVariantId === variant.id
              }
              onSelect={(variantId: number) => {
                setSelectedProduct(product);
                setSelectedVariantId(variantId);
                setShowConfirm(true);
              }}
              showQuickBuy={variants.length > 2}
            />
          ))}
        </View>

        {/* Selected Product CTA */}
        {isSelected && (
          <TouchableOpacity
            style={styles.continueButton}
            onPress={() => setShowConfirm(true)}
          >
            <Text style={styles.continueButtonText}>Continue to checkout</Text>
            <Icon name="arrow-forward" size={18} color="#FFF" />
          </TouchableOpacity>
        )}
      </Animated.View>
    );
  };

  return (
    <LinearGradient
      colors={[colors.background, colors.backgroundSecondary]}
      style={styles.container}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Animated Header */}
        <Animated.View
          style={[
            styles.header,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <LinearGradient
            colors={[ACCENT, ACCENT_DARK]}
            style={styles.headerIconContainer}
          >
            <Icon
              name={
                isRoseCategory
                  ? 'rose'
                  : isRewindCategory
                  ? 'arrow-undo'
                  : isDirectMessageCategory
                  ? 'chatbubble-ellipses'
                  : 'flash'
              }
              size={48}
              color="#FFF"
            />
          </LinearGradient>
          <Text style={styles.title}>
            {isRoseCategory
              ? 'Roses'
              : isRewindCategory
              ? 'Rewind'
              : isDirectMessageCategory
              ? 'Direct Messages'
              : 'Super Likes'}
          </Text>
          <Text style={styles.subtitle}>
            {isRoseCategory
              ? 'Roses are spent on Super Likes to get noticed instantly'
              : isRewindCategory
              ? 'Recover a match you accidentally passed on'
              : isDirectMessageCategory
              ? 'Message someone before you match — it lands in their Likes with your like'
              : 'Get noticed instantly by more people'}
          </Text>

          {isRoseCategory && currentRoses !== null && (
            <View style={styles.balanceRow}>
              <Icon name="rose" size={14} color={colors.primary} />
              <Text style={styles.balanceText}>
                You have {currentRoses} rose{currentRoses === 1 ? '' : 's'}
              </Text>
            </View>
          )}

          {/* Stats Row */}
          {!isRewindCategory && (
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Icon name="people" size={16} color={ACCENT} />
                <Text style={styles.statText}>2x more views</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Icon name="chatbubbles" size={16} color={ACCENT} />
                <Text style={styles.statText}>3x more matches</Text>
              </View>
            </View>
          )}
        </Animated.View>

        {/* Products List */}
        <View style={styles.productsContainer}>
          {products.map(product => (
            <ProductCard key={product.sku} product={product} />
          ))}
        </View>

        {/* Trust Indicators */}
        <View style={styles.trustSection}>
          <View style={styles.trustItem}>
            <Icon name="lock-closed" size={14} color={colors.textTertiary} />
            <Text style={styles.trustText}>Secure checkout</Text>
          </View>
          <View style={styles.trustItem}>
            <Icon name="card" size={14} color={colors.textTertiary} />
            <Text style={styles.trustText}>Instant delivery</Text>
          </View>
          <View style={styles.trustItem}>
            <Icon name="help-circle" size={14} color={colors.textTertiary} />
            <Text style={styles.trustText}>24/7 support</Text>
          </View>
        </View>

        <Text style={styles.disclaimer}>
          One-time purchase. No recurring charges. Instant delivery to your
          account.
        </Text>
      </ScrollView>

      {/* Improved Confirmation Modal */}
      {showConfirm && selectedProduct && (
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowConfirm(false)}
        >
          <Animated.View style={styles.modalContent}>
            {/* Close button */}
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setShowConfirm(false)}
            >
              <Icon name="close" size={24} color={colors.textTertiary} />
            </TouchableOpacity>

            <View style={styles.modalIcon}>
              <LinearGradient
                colors={[ACCENT, ACCENT_DARK]}
                style={styles.modalIconGradient}
              >
                <Icon name="cart" size={32} color="#FFF" />
              </LinearGradient>
            </View>

            <Text style={styles.modalTitle}>Confirm your purchase</Text>
            <Text style={styles.modalSubtitle}>
              Review your order details below
            </Text>

            <View style={styles.modalDetails}>
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Item</Text>
                <Text style={styles.modalValue}>{selectedProduct.name}</Text>
              </View>

              {(() => {
                const variant =
                  selectedProduct.variants?.find(
                    (v: any) => v.id === selectedVariantId,
                  ) ||
                  selectedProduct.variants?.[0] ||
                  null;
                const { cycle, savings } = getVariantInfo(variant);

                return (
                  <>
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>Package</Text>
                      <Text style={styles.modalValue}>{cycle}</Text>
                    </View>

                    {savings > 0 && (
                      <View style={styles.modalRow}>
                        <Text style={styles.modalLabel}>Savings</Text>
                        <View style={styles.savingsBadge}>
                          <Icon
                            name="trending-down"
                            size={12}
                            color={colors.success}
                          />
                          <Text style={styles.savingsBadgeText}>
                            Save {savings}%
                          </Text>
                        </View>
                      </View>
                    )}

                    <View style={[styles.modalRow, styles.modalTotal]}>
                      <Text style={styles.modalTotalLabel}>Total</Text>
                      <Text style={styles.modalPrice}>
                        ${formatPrice(variant?.price || 0)}
                      </Text>
                    </View>
                  </>
                );
              })()}
            </View>

            <TouchableOpacity
              style={styles.purchaseButton}
              onPress={handlePurchase}
            >
              <Text style={styles.purchaseButtonText}>Complete Purchase</Text>
              <Icon name="arrow-forward" size={18} color="#FFF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.nativeButton}
              onPress={handleNativePurchase}
            >
              <Icon
                name={
                  Platform.OS === 'ios' ? 'logo-apple' : 'logo-google-playstore'
                }
                size={18}
                color={colors.text}
              />
              <Text style={styles.nativeButtonText}>
                {Platform.OS === 'ios'
                  ? 'Pay with Apple'
                  : 'Pay with Google Play'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowConfirm(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      )}
    </LinearGradient>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 20, paddingBottom: 40 },

    // Header styles
    header: {
      alignItems: 'center',
      marginBottom: 32,
      paddingTop: 20,
    },
    headerIconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
      shadowColor: ACCENT,
      shadowOpacity: 0.4,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 4 },
      elevation: 8,
    },
    title: {
      color: colors.text,
      fontSize: 32,
      fontWeight: '800',
      marginBottom: 8,
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: 14,
      textAlign: 'center',
      marginBottom: 16,
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      marginTop: 8,
    },
    statItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    statText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '500',
    },
    statDivider: {
      width: 1,
      height: 20,
      backgroundColor: colors.border,
      marginHorizontal: 12,
    },
    balanceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.primarySoft,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 14,
      marginBottom: 12,
    },
    balanceText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '700',
    },

    productsContainer: {
      gap: 20,
      marginBottom: 24,
    },

    // Product card styles
    productCard: {
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    productCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 20,
      gap: 12,
    },
    productIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    productInfo: {
      flex: 1,
    },
    productName: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 4,
    },
    productDescription: {
      color: colors.textSecondary,
      fontSize: 12,
    },
    featureCount: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.backgroundSecondary,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    featureCountText: {
      color: ACCENT,
      fontSize: 12,
      fontWeight: '600',
    },

    featuresSection: {
      marginBottom: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    featureItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 10,
    },
    featureIconCircle: {
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    featureText: {
      color: colors.text,
      fontSize: 13,
      flex: 1,
      lineHeight: 18,
    },
    expandButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingTop: 8,
      marginTop: 4,
    },
    expandButtonText: {
      color: ACCENT,
      fontSize: 12,
      fontWeight: '600',
    },

    variantsGrid: {
      gap: 12,
      marginBottom: 16,
    },

    variantCard: {
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1.5,
      borderColor: colors.border,
      position: 'relative',
    },
    variantCardSelected: {
      borderColor: ACCENT,
      backgroundColor: colors.accentSoft,
    },
    popularBadge: {
      position: 'absolute',
      top: -1,
      left: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: ACCENT,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderBottomLeftRadius: 10,
      borderBottomRightRadius: 10,
      zIndex: 1,
    },
    popularBadgeSelected: {
      backgroundColor: ACCENT_DARK,
    },
    popularText: {
      color: '#FFF',
      fontSize: 10,
      fontWeight: '700',
    },
    discountBadge: {
      position: 'absolute',
      top: 12,
      right: 12,
      backgroundColor: `${colors.success}20`,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      zIndex: 1,
    },
    discountBadgeSelected: {
      backgroundColor: `${colors.success}30`,
    },
    discountText: {
      color: colors.success,
      fontSize: 11,
      fontWeight: '700',
    },
    variantCardContent: {
      gap: 8,
    },
    variantHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    variantCycle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '600',
    },
    variantCycleSelected: {
      color: colors.text,
    },
    savingsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    savingsText: {
      color: colors.success,
      fontSize: 11,
      fontWeight: '600',
    },
    priceContainer: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 8,
    },
    variantPrice: {
      color: ACCENT,
      fontSize: 22,
      fontWeight: '800',
    },
    variantPriceSelected: {
      color: ACCENT,
    },
    originalPrice: {
      color: colors.textTertiary,
      fontSize: 14,
      textDecorationLine: 'line-through',
    },
    quickBuyButton: {
      marginTop: 8,
      paddingVertical: 6,
      borderRadius: 10,
      borderWidth: 1,
      alignItems: 'center',
    },
    quickBuyText: {
      color: ACCENT,
      fontSize: 12,
      fontWeight: '600',
    },
    selectedIndicator: {
      position: 'absolute',
      bottom: 12,
      right: 12,
    },
    continueButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: ACCENT,
      paddingVertical: 14,
      borderRadius: 14,
      marginTop: 8,
    },
    continueButtonText: {
      color: '#FFF',
      fontSize: 15,
      fontWeight: '700',
    },

    trustSection: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 24,
      marginBottom: 16,
    },
    trustItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    trustText: {
      color: colors.textTertiary,
      fontSize: 11,
    },

    disclaimer: {
      color: colors.textTertiary,
      fontSize: 11,
      textAlign: 'center',
      lineHeight: 16,
    },

    // Modal styles - Improved
    modalOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderRadius: 32,
      padding: 24,
      width: '90%',
      maxWidth: 400,
      position: 'relative',
    },
    modalClose: {
      position: 'absolute',
      top: 16,
      right: 16,
      zIndex: 1,
      padding: 4,
    },
    modalIcon: {
      alignItems: 'center',
      marginBottom: 20,
      marginTop: 8,
    },
    modalIconGradient: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalTitle: {
      color: colors.text,
      fontSize: 24,
      fontWeight: '800',
      textAlign: 'center',
      marginBottom: 8,
    },
    modalSubtitle: {
      color: colors.textSecondary,
      fontSize: 13,
      textAlign: 'center',
      marginBottom: 24,
    },
    modalDetails: {
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 20,
      padding: 20,
      marginBottom: 24,
    },
    modalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
    },
    modalLabel: {
      color: colors.textSecondary,
      fontSize: 14,
    },
    modalValue: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '500',
    },
    savingsBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: `${colors.success}20`,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 12,
    },
    savingsBadgeText: {
      color: colors.success,
      fontSize: 12,
      fontWeight: '600',
    },
    modalTotal: {
      marginTop: 8,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      marginBottom: 0,
    },
    modalTotalLabel: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '700',
    },
    modalPrice: {
      color: ACCENT,
      fontSize: 24,
      fontWeight: '800',
    },
    purchaseButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: ACCENT,
      paddingVertical: 16,
      borderRadius: 16,
      marginBottom: 12,
    },
    purchaseButtonText: {
      color: '#FFF',
      fontSize: 16,
      fontWeight: '700',
    },
    nativeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 14,
      borderRadius: 16,
      marginBottom: 12,
    },
    nativeButtonText: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '700',
    },
    cancelButton: {
      paddingVertical: 12,
    },
    cancelButtonText: {
      color: colors.textSecondary,
      fontSize: 14,
      textAlign: 'center',
    },
  });
