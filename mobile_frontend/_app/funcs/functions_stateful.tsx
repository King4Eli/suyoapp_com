// https://ionic.io/ionicons 
// https://static.enapter.com/rn/icons/material-community.html 
// https://oblador.github.io/react-native-vector-icons/ 
import { ActivityIndicator, View, Text, Animated } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import React from 'react';

import { BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { useTheme } from './theme';

//****************************
//
//
let showLoaderFunc: (opts: any) => void;
export const Loaderx = () => {
  const [getLoader, setLoader] = useState<boolean>(false);
  useEffect(() => { showLoaderFunc = (opts) => { setLoader(opts); }; }, []);
  if (!getLoader) return null;
  return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 1011, }}>
    <ActivityIndicator size="large" color="#fff" />
    <Text style={{ color: '#fff', marginTop: 8 }}>Loading...</Text>
  </View>;
};
Loaderx.show = () => { if (showLoaderFunc) { showLoaderFunc(true); } else { console.warn('Loader show is not mounted yet.'); } };
Loaderx.hide = () => { if (showLoaderFunc) { showLoaderFunc(false); } else { console.warn('Loader Hide is not mounted yet.'); } }
//*****************************
//
//



export const bottomsheet_renderBackdrop =  (props: any) =>
(<BottomSheetBackdrop {...props}
    appearsOnIndex={0}
    disappearsOnIndex={-0.9}
/>) ;
//*****************************
//
//

// A single pulsing placeholder block. Screens compose these into whatever shape
// their loaded content will take (a photo rect, a line of text, a chip, ...) instead
// of a shared full-layout skeleton, since every screen's real layout differs.
export const Skeleton = ({ style }: { style?: any }) => {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return <Animated.View style={[{ backgroundColor: colors.skeleton, borderRadius: 8, opacity }, style]} />;
};
//*****************************
//
//
