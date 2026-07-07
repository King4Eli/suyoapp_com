import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createStackNavigator } from '@react-navigation/stack';
import IIcon from 'react-native-vector-icons/Ionicons';
import MIcon from "react-native-vector-icons/MaterialCommunityIcons";

import Peoples_Screen from './Peoples';
import { Screen_likes } from './Likes';
import { Screen_chat } from './Chats';
import { Screen_profile } from './Profile';
import { Screen_conversation } from './Conversations';
import { Auth_Login } from './Auth_Login';
import { Loaderx } from '../funcs/functions_stateful';
import { Screen_settings } from './Settings';
import { Screen_editprofile } from './ProfileEdit';
import { sessionManager, SessionTypes } from '../funcs/SessionContext';
import { Screen_editpreference } from './PreferenceEdit';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Zz_nofilee } from './zz_nofilee';
import { namer, resourceMap } from '../funcs/static';
import { Screen_PurchaseSubscribe } from './Purchase_Subscribe';
import { __init__app, handleDeepLink, logReport, navigationRef } from '../funcs/functions';
import { SocketClient } from '../funcs/socket_realtimeData';
import { Linking, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Toastx } from '../funcs/customNotification'; 
import LottieView from 'lottie-react-native';
import { Zz_devv } from './zz_devv';
import { Auth_Signup } from './Auth_Signup';
import { Screen_PurchaseConsumable } from './Purchase_Consumable';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';

// Type definitions for props if needed
const Stack = createStackNavigator<any>();
const TabBottom = createBottomTabNavigator<any>();

const MainApp: React.FC = () => {
  const [currentSession, setCurrentSession] = useState<SessionTypes | null>(sessionManager.getCurrentSession());
  const [getAllGood, setAllGood] = useState(false);

  // Handle deep linking to Settings screen
  useEffect(() => {
    // cold start
    Linking.getInitialURL().then((url) => { if (url) { handleDeepLink(url); } });
    // running app
    const sub = Linking.addEventListener('url', (e) => { handleDeepLink(e.url); });
    return () => sub.remove();
  }, []);


  // Handle session subscription
  useEffect(() => {
    const unsubscribe = sessionManager.subscribe((newSession) => { setCurrentSession(newSession); });
    return () => unsubscribe(); // Cleanup on unmount
  }, []);

  // Fetch initial data
  useEffect(() => {
    //let socketListen: Function = () => { };
    const initializeApp = async () => {
      try {
        setAllGood(false);
        // Reset session and fetch mapper data
        const [_, sessIdStorage, sessIdVerifyStorage] = await Promise.all([
          sessionManager.updateSession({ x_omi_payload: null, x_omi_payload_hash: null }),
          AsyncStorage.getItem(namer.storage.sessionId),
          AsyncStorage.getItem(namer.storage.sessionIdVerify),
        ]);

        if (sessIdStorage !== null) {
          await sessionManager.updateSession({ x_omi_payload: sessIdStorage, x_omi_payload_hash: sessIdVerifyStorage });
        }
      } catch (error: any) {
        logReport({
          type: "function",
          extra: error?.message || String(error),
          useraction: 'initializeApp',
          logMessage: error?.message || String(error),
          stackTrace: error
        });
        Toastx.show({ message: 'Error initializing app', type: 'error', duration: 9000 });
      }
    };


    initializeApp().then(async () => {
      await __init__app();
    }).finally(() => {
      setAllGood(true);
    });
    return () => {
      SocketClient.disconnect();
    }
  }, []); // Runs only once on mount




  const BottomTabNavigator = () => (
    <TabBottom.Navigator initialRouteName={namer.navigation.peoples}>

      <TabBottom.Screen name={namer.navigation.likes} component={Screen_likes}
        options={{
          headerTransparent: true,
          tabBarIcon: () => <IIcon name="heart-half-outline" size={32} color="#4F8EF7" />
        }} />
      <TabBottom.Screen name={namer.navigation.chat} component={Screen_chat}
        options={{
          headerTransparent: true,
          tabBarIcon: () => <IIcon name="chatbubble-ellipses-outline" size={30} color="#4F8EF7" />,
          headerTitleAlign: 'center',
        }} />
      <TabBottom.Screen name={namer.navigation.peoples} component={Peoples_Screen}
        options={{
          headerShown: false,
          tabBarIcon: () => <MIcon name="cards-outline" size={30} color="#4F8EF7" />,
        }} />
 
      <TabBottom.Screen name={namer.navigation.profile} component={Screen_profile} options={{
        tabBarIcon: () => <IIcon name="person-outline" size={30} color="#4F8EF7" />,
      }} />
    </TabBottom.Navigator>
  );


  if (getAllGood === false) {
    return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }}><LottieView source={resourceMap.lottie.infinityLoading} autoPlay loop style={{ width: 220, height: 220 }} /></View>
  }



  return (
    <>
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator initialRouteName={currentSession?.x_omi_payload_hash ? "Home" : namer.navigation.login}>

          {!currentSession?.x_omi_payload_hash ?
            (
              <>
                <Stack.Screen name={namer.navigation.login} component={Auth_Login} options={{ headerShown: false }} />
                <Stack.Screen name={namer.navigation.signup} component={Auth_Signup} options={{ headerShown: false }} />
              </>
            ) : (
              <>
                <Stack.Screen name="Home" component={BottomTabNavigator} options={{ headerShown: false }} />
                <Stack.Screen name={namer.navigation.conversation} component={Screen_conversation} options={{ headerBackTitle: '', headerTransparent: true }} />
                <Stack.Screen name={namer.navigation.editprofile} component={Screen_editprofile} options={{ headerBackTitle: '', headerTransparent: true }} />
                <Stack.Screen name={namer.navigation.editpreference} component={Screen_editpreference} />
                <Stack.Screen name={namer.navigation.peoplesOnePerson} component={Peoples_Screen} options={{ headerBackTitle: '' }} />
                <Stack.Screen name={namer.navigation.subscription} component={Screen_PurchaseSubscribe} options={{
                  headerTintColor: "#6d6139ff", title: "Upgrade Your Experience", headerBackTitle: '', headerTitleAlign: "center", headerTitleStyle: {
                    fontSize: 20,
                    fontWeight: 'bold',
                    color: '#fff',
                    fontFamily: 'Helvetica',
                  }, headerStyle: { backgroundColor: '#1a1919ff' }
                }} />
                <Stack.Screen name={namer.navigation.consumables} component={Screen_PurchaseConsumable} options={{
                  headerTintColor: "#6d6139ff", title: "Upgrade Your Experience", headerBackTitle: '', headerTitleAlign: "center", headerTitleStyle: {
                    fontSize: 20,
                    fontWeight: 'bold',
                    color: '#fff',
                    fontFamily: 'Helvetica',
                  }, headerStyle: { backgroundColor: '#1a1919ff' }
                }} />
                <Stack.Screen name={namer.navigation.settings} component={Screen_settings} options={{ headerBackTitle: '' }} />

              </>
            )}
          <Stack.Screen name={namer.navigation.devpage} component={Zz_devv} options={{}} />
          <Stack.Screen name={"zz_nofile"} component={Zz_nofilee} options={{}} />

        </Stack.Navigator>
      </NavigationContainer>

    </>
  );
};




const App = () => (
  <SafeAreaProvider style={{ flex: 1, position: 'relative' }}>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <Loaderx />
      <MainApp />
      <Toastx />
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  </SafeAreaProvider>
);

export default App;
