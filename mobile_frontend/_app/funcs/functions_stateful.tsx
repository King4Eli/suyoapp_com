// https://ionic.io/ionicons 
// https://static.enapter.com/rn/icons/material-community.html 
// https://oblador.github.io/react-native-vector-icons/ 
import { ActivityIndicator, View, Text } from 'react-native';
import { useEffect, useState } from 'react';
import React from 'react';

import { BottomSheetBackdrop } from '@gorhom/bottom-sheet';

//****************************
//
//
let showLoaderFunc: (opts: any) => void;
export const Loaderx = () => {
  const [getLoader, setLoader] = useState<boolean>(false);
  useEffect(() => { showLoaderFunc = (opts) => { setLoader(opts); }; }, []);
  if (!getLoader) return null;
  return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 1011, }}>
    <ActivityIndicator size="large" color="#0000ff" />
    <Text>Loading...</Text>
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
