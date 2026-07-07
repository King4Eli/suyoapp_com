import { useState, useRef, useEffect } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import IIcon from 'react-native-vector-icons/Ionicons';
import { screenWidth } from "./functions";


let showToastFunc: (opts: any) => void;
type ToastOptions = {
  title?: string;
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
  icon?: string;
  position?: 'top' | 'bottom';
  onPress?: () => void; // Just one optional tap handler
};

export const Toastx = () => {
  const [toast, setToast] = useState<ToastOptions | null>(null);
  const [opacity] = useState(new Animated.Value(0));
  const [translateY] = useState(new Animated.Value(-24));
  const inset = useSafeAreaInsets();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const theme = {
    success: { bg: '#e8f7ef', text: '#0f5132', border: '#b7e4c7', icon: 'checkmark-circle' },
    error: { bg: '#fdecec', text: '#842029', border: '#f5c2c7', icon: 'alert-circle' },
    info: { bg: '#e7f1ff', text: '#0a4fa3', border: '#cfe2ff', icon: 'information-circle' },
    warning: { bg: '#fff4e5', text: '#9c5700', border: '#ffe0b2', icon: 'alert' },
    default: { bg: '#1f2937', text: '#f9fafb', border: '#374151', icon: 'information-circle' }
  };

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(translateY, {
        toValue: toast?.position === 'bottom' ? 24 : -24,
        duration: 200,
        useNativeDriver: true
      })
    ]).start(() => setToast(null));
  };

  useEffect(() => {
    showToastFunc = (opts: ToastOptions) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setToast(opts);
      // Set initial position based on toast position
      const initialY = opts.position === 'bottom' ? 24 : -24;
      translateY.setValue(initialY);

      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true
        })
      ]).start();

      const dur = opts.duration && opts.duration > 0 ? opts.duration : 5000;
      if (dur > 0) {
        timerRef.current = setTimeout(() => {
          hideToast();
        }, dur);
      }
    };

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!toast) return null;

  const palette = theme[toast.type ?? 'default'];
  const iconName = toast.icon ?? palette.icon;
  const isBottom = toast.position === 'bottom';

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        zIndex: 1000,
        position: 'absolute',
        left: 0,
        right: 0,
        top: isBottom ? undefined : inset.top + 24,
        bottom: isBottom ? inset.bottom + 24 : undefined,
        alignItems: 'center',
        opacity,
        transform: [{ translateY }]
      }}>
      <Pressable
        onPress={() => {
          toast.onPress?.();
          hideToast();
        }}
        style={{
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderWidth: 1,
          paddingHorizontal: 16,
          paddingVertical: 12,
          minWidth: screenWidth / 1.2,
          maxWidth: screenWidth - 32,
          borderRadius: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          shadowColor: '#000',
          shadowOpacity: 0.18,
          shadowOffset: { width: 0, height: 8 },
          shadowRadius: 12,
          elevation: 6,
        }}>
        <IIcon name={iconName} size={22} color={palette.text} />

        <View style={{ flex: 1, gap: 3 }}>
          {toast.title && <Text style={{
            color: palette.text,
            fontWeight: '600',
            lineHeight: 20, letterSpacing: 1.1,
            fontSize: 14, textTransform: "capitalize"
          }}>{toast.title}</Text>}

          <Text style={{
            color: palette.text,
            fontWeight: '600',
            fontSize: 14, textTransform: "capitalize"
          }}>{toast.message}</Text>
        </View>

        {/* Simple close button */}
        <TouchableOpacity
          onPress={hideToast}
          style={{ padding: 4 }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <IIcon name="close" size={18} color={palette.text} />
        </TouchableOpacity>
      </Pressable>
    </Animated.View>
  );
};

// Enhanced show function
Toastx.show = (options: ToastOptions) => {
  if (showToastFunc) {
    showToastFunc(options);
  } else {
    console.warn('Toast is not mounted yet.');
  }
}; 
