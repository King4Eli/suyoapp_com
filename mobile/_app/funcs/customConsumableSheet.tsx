import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import IIcon from 'react-native-vector-icons/Ionicons';
import {
  _http_request,
  cacheStorage,
  parseCategoryProducts,
} from './functions';
import { Loaderx } from './functions_stateful';
import { purchaseNative } from './iap';
import { __CONFIG__ } from './static';
import { useTheme, ThemeColors } from './theme';

type OnetimeCheckout = { sku: string; variantId: number; matchId?: string };

/**
 * Starts a Stripe-hosted one-time checkout and opens it in the browser. The
 * price is resolved server-side from the variant id; the /payment/success deep
 * link refreshes the profile once it's paid.
 */
export async function startWebOnetimeCheckout({
  sku,
  variantId,
  matchId,
}: OnetimeCheckout): Promise<boolean> {
  Loaderx.show();
  try {
    const res: any = await _http_request({
      customApiUrl: `${__CONFIG__.HTTPS_API_DOMAIN}/api/secure/gateway/onetime`,
      reqType: 'POST',
      bodyArray: {
        sku,
        ot_duration: variantId,
        quantity: 1,
        ...(matchId ? { matchId } : {}),
      },
    });
    if (res?.code === 301 && res?.type === 'external' && res?.url) {
      Linking.openURL(res.url);
      return true;
    }
    Alert.alert('Error', res?.message || 'Purchase failed. Please try again.');
    return false;
  } finally {
    Loaderx.hide();
  }
}

type SheetVariant = {
  id: number;
  name: string;
  price: number;
  discount: string;
  storeProductId: string | null;
  sku: string;
};

/**
 * Bottom popup listing the one-time packs of a product category (roses, boost)
 * with prices from getProducts, and buying the selected one.
 */
export function ConsumableSheet({
  visible,
  category,
  title,
  subtitle,
  icon,
  onClose,
  onPurchased,
}: {
  visible: boolean;
  category: string;
  title: string;
  subtitle?: string;
  icon: string;
  onClose: () => void;
  onPurchased?: () => void;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const [variants, setVariants] = useState<SheetVariant[] | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    if (!visible) return;
    let mounted = true;
    setVariants(null);
    (async () => {
      try {
        const raw = await cacheStorage.getProducts();
        const parsed: any = await parseCategoryProducts(raw, category);
        const products: any[] = Array.isArray(parsed) ? parsed : [];
        const list: SheetVariant[] = products.flatMap((product: any) =>
          (Array.isArray(product?.variants) ? product.variants : []).map(
            (v: any) => ({
              id: Number(v?.id),
              name: String(v?.name ?? ''),
              price: Number(v?.price ?? 0),
              discount: String(v?.metadata?.discount ?? ''),
              storeProductId: v?.store_product_id ?? null,
              sku: product?.sku,
            }),
          ),
        );
        if (mounted) {
          setVariants(list);
          setSelectedId(list[0]?.id ?? null);
        }
      } catch {
        if (mounted) setVariants([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [visible, category]);

  const selected = variants?.find(v => v.id === selectedId) ?? null;

  const buyWeb = async () => {
    if (!selected) return;
    const ok = await startWebOnetimeCheckout({
      sku: selected.sku,
      variantId: selected.id,
    });
    if (ok) onClose();
  };

  const buyNative = async () => {
    if (!selected) return;
    Loaderx.show();
    const result = await purchaseNative({
      purchaseType: 'onetime',
      sku: selected.sku,
      variantId: selected.id,
      storeProductId: selected.storeProductId,
    });
    Loaderx.hide();
    if (result.code === 200) {
      onClose();
      onPurchased?.();
      Alert.alert('Success', 'Your purchase was completed.');
    } else if (result.code !== 499) {
      Alert.alert(
        'Error',
        result.message ?? 'Purchase failed. Please try again.',
      );
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.header}>
          <View style={s.headerIcon}>
            <IIcon name={icon} size={24} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>{title}</Text>
            {!!subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
          </View>
          <Pressable onPress={onClose} hitSlop={10}>
            <IIcon name="close" size={24} color={colors.textTertiary} />
          </Pressable>
        </View>

        {variants === null ? (
          <ActivityIndicator style={{ marginVertical: 32 }} />
        ) : variants.length === 0 ? (
          <Text style={s.empty}>Nothing available to buy right now.</Text>
        ) : (
          <View style={s.list}>
            {variants.map(v => {
              const isSelected = v.id === selectedId;
              return (
                <Pressable
                  key={v.id}
                  onPress={() => setSelectedId(v.id)}
                  style={[s.row, isSelected && s.rowSelected]}
                >
                  <IIcon
                    name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={isSelected ? colors.primary : colors.textTertiary}
                  />
                  <Text style={s.rowName}>{v.name}</Text>
                  {!!v.discount && (
                    <Text style={s.rowDiscount}>
                      -{parseInt(v.discount, 10)}%
                    </Text>
                  )}
                  <Text style={s.rowPrice}>${v.price.toFixed(2)}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <Pressable
          style={[s.buyButton, !selected && s.disabled]}
          disabled={!selected}
          onPress={buyWeb}
        >
          <Text style={s.buyText}>
            {selected ? `Buy for $${selected.price.toFixed(2)}` : 'Buy'}
          </Text>
        </Pressable>
        <Pressable
          style={[s.nativeButton, !selected && s.disabled]}
          disabled={!selected}
          onPress={buyNative}
        >
          <IIcon
            name={
              Platform.OS === 'ios' ? 'logo-apple' : 'logo-google-playstore'
            }
            size={18}
            color={colors.text}
          />
          <Text style={s.nativeText}>
            {Platform.OS === 'ios' ? 'Pay with Apple' : 'Pay with Google Play'}
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      paddingBottom: 36,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 16,
    },
    headerIcon: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primarySoft,
    },
    title: { color: colors.text, fontSize: 18, fontWeight: '900' },
    subtitle: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '600',
      marginTop: 2,
    },
    empty: {
      color: colors.textSecondary,
      textAlign: 'center',
      marginVertical: 32,
    },
    list: { gap: 10, marginBottom: 18 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 14,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.backgroundSecondary,
    },
    rowSelected: { borderColor: colors.primary },
    rowName: {
      flex: 1,
      color: colors.text,
      fontSize: 15,
      fontWeight: '800',
      textTransform: 'capitalize',
    },
    rowDiscount: { color: colors.success, fontSize: 12, fontWeight: '800' },
    rowPrice: { color: colors.text, fontSize: 16, fontWeight: '900' },
    buyButton: {
      backgroundColor: colors.primary,
      borderRadius: 16,
      paddingVertical: 15,
      alignItems: 'center',
      marginBottom: 10,
    },
    buyText: { color: colors.onPrimary, fontSize: 16, fontWeight: '800' },
    nativeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 16,
      paddingVertical: 13,
      borderWidth: 1,
      borderColor: colors.border,
    },
    nativeText: { color: colors.text, fontSize: 15, fontWeight: '700' },
    disabled: { opacity: 0.5 },
  });
