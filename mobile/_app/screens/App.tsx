import React, { useEffect, useState } from 'react';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import IIcon from 'react-native-vector-icons/Ionicons';
import MIcon from 'react-native-vector-icons/MaterialCommunityIcons';

import Peoples_Screen from './Peoples';
import { Screen_likes } from './Likes';
import { Screen_feed } from './Feed';
import { Screen_chat } from './Chats';
import { Screen_profile } from './Profile';
import { Screen_conversation } from './Conversations';
import { Auth_Login } from './Auth_Login';
import { Loaderx } from '../funcs/functions_stateful';
import { Screen_settings } from './Settings';
import { Screen_notificationSettings } from './NotificationSettings';
import { Screen_editprofile } from './ProfileEdit';
import { Screen_profileVerify } from './ProfileVerify';
import { Screen_editProfilePrompts } from './ProfileEditPrompts';
import { Screen_editProfileInterests } from './ProfileEditInterests';
import { Screen_editProfileLocation } from './ProfileEditLocation';
import { sessionManager, SessionTypes } from '../funcs/SessionContext';
import { Screen_editpreference } from './PreferenceEdit';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { namer, resourceMap } from '../funcs/static';
import { Screen_PurchaseSubscribe } from './Purchase_Subscribe';
import {
  __init__app,
  handleDeepLink,
  logReport,
  navigationRef,
} from '../funcs/functions';
import { SocketClient } from '../funcs/socket_realtimeData';
import { chatsBadge, likesBadge, useBadgeCount } from '../funcs/tabBadges';
import { Linking, StatusBar, View } from 'react-native';
import { ThemeProvider, useTheme } from '../funcs/theme';
import { UnitsProvider } from '../funcs/units';
import { HEADER_SIDE_INSET } from '../funcs/customHeader';
import { ResponsiveScreen } from '../funcs/responsive';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Toastx } from '../funcs/customNotification';
import { Dialogx } from '../funcs/customDialog';
import LottieView from 'lottie-react-native';
import { Zz_devv } from './zz_devv';
import { Auth_Signup } from './Auth_Signup';
import { Screen_PurchaseConsumable } from './Purchase_Consumable';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';

// Type definitions for props if needed
const Stack = createNativeStackNavigator<any>();
const TabBottom = createBottomTabNavigator<any>();
const TAB_HEADER_HEIGHT = 60;
// Centre every screen's content in a capped-width column (tablets, landscape)
const renderResponsiveScreen = ({
  children,
}: {
  children: React.ReactElement;
}) => <ResponsiveScreen>{children}</ResponsiveScreen>;

const MainApp: React.FC = () => {
  const [currentSession, setCurrentSession] = useState<SessionTypes | null>(
    sessionManager.getCurrentSession(),
  );
  const [getAllGood, setAllGood] = useState(false);
  const { colors, resolvedScheme } = useTheme();

  const navigationTheme = {
    ...(resolvedScheme === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(resolvedScheme === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      primary: colors.primary,
      background: colors.background,
      card: colors.surfaceElevated,
      text: colors.text,
      border: colors.border,
      notification: colors.danger,
    },
  };

  // Handle deep linking to Settings screen
  useEffect(() => {
    // cold start
    Linking.getInitialURL().then(url => {
      if (url) {
        handleDeepLink(url);
      }
    });
    // running app
    const sub = Linking.addEventListener('url', e => {
      handleDeepLink(e.url);
    });
    return () => sub.remove();
  }, []);

  // Handle session subscription
  useEffect(() => {
    const unsubscribe = sessionManager.subscribe(newSession => {
      setCurrentSession(newSession);
    });
    return () => unsubscribe(); // Cleanup on unmount
  }, []);

  // Fetch initial data
  useEffect(() => {
    //let socketListen: Function = () => { };
    const initializeApp = async () => {
      try {
        setAllGood(false);
        // Reset session and fetch mapper data
        const [_, sessIdStorage] = await Promise.all([
          sessionManager.updateSession({ x_omi_payload: null }),
          AsyncStorage.getItem(namer.storage.sessionId),
        ]);

        if (sessIdStorage !== null) {
          await sessionManager.updateSession({ x_omi_payload: sessIdStorage });
        }
      } catch (error: any) {
        logReport({
          type: 'function',
          extra: error?.message || String(error),
          useraction: 'initializeApp',
          logMessage: error?.message || String(error),
        });
        Toastx.show({
          message: 'Error initializing app',
          type: 'error',
          duration: 9000,
        });
      }
    };

    initializeApp()
      .then(async () => {
        await __init__app();
      })
      .finally(() => {
        setAllGood(true);
      });
    return () => {
      SocketClient.disconnect();
    };
  }, []); // Runs only once on mount

  const BottomTabNavigator = () => {
    const likesCount = useBadgeCount(likesBadge);
    const chatsCount = useBadgeCount(chatsBadge);
    const insets = useSafeAreaInsets();
    return (
      <TabBottom.Navigator
        initialRouteName={namer.navigation.peoples}
        screenLayout={renderResponsiveScreen}
        screenOptions={{
          tabBarShowLabel: true,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textTertiary,
          // Same header on iOS and Android: the platform defaults differ in
          // height (44 vs 64) and title size/alignment.
          headerStyle: {
            backgroundColor: colors.background,
            height: insets.top + TAB_HEADER_HEIGHT,
          },
          headerShadowVisible: false,
          headerLeftContainerStyle: { paddingLeft: HEADER_SIDE_INSET },
          headerRightContainerStyle: { paddingRight: HEADER_SIDE_INSET },
          headerTitleAlign: 'center',
          headerTitleStyle: {
            color: colors.text,
            fontSize: 18,
            fontWeight: '800',
          },
        }}
      >
        <TabBottom.Screen
          name={namer.navigation.likes}
          component={Screen_likes}
          options={{
            tabBarLabel: 'Likes',
            tabBarBadge:
              likesCount > 0 ? (likesCount > 9 ? '9+' : likesCount) : undefined,
            tabBarIcon: ({ color }) => (
              <IIcon name="heart-half-outline" size={32} color={color} />
            ),
          }}
        />
        <TabBottom.Screen
          name={namer.navigation.chat}
          component={Screen_chat}
          options={{
            tabBarLabel: 'Chat',
            tabBarBadge:
              chatsCount > 0 ? (chatsCount > 9 ? '9+' : chatsCount) : undefined,
            tabBarIcon: ({ color }) => (
              <IIcon
                name="chatbubble-ellipses-outline"
                size={30}
                color={color}
              />
            ),
          }}
        />
        <TabBottom.Screen
          name={namer.navigation.peoples}
          component={Peoples_Screen}
          options={{
            tabBarLabel: 'Peoples',
            tabBarIcon: ({ color }) => (
              <MIcon name="cards-outline" size={30} color={color} />
            ),
          }}
        />
        {/*<TabBottom.Screen
        name={namer.navigation.feed}
        component={Screen_feed}
        options={{
          tabBarLabel: 'Feed',
          tabBarIcon: ({ color }) => (
            <IIcon name="newspaper-outline" size={28} color={color} />
          ),
        }}
      />*/}

        <TabBottom.Screen
          name={namer.navigation.profile}
          component={Screen_profile}
          options={{
            tabBarLabel: 'Profile',
            tabBarIcon: ({ color }) => (
              <IIcon name="person-outline" size={30} color={color} />
            ),
          }}
        />
      </TabBottom.Navigator>
    );
  };

  if (getAllGood === false) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
        }}
      >
        <StatusBar
          barStyle={colors.statusBarStyle}
          backgroundColor={colors.background}
        />
        <LottieView
          source={resourceMap.lottie.infinityLoading}
          autoPlay
          loop
          style={{ width: 220, height: 220 }}
        />
      </View>
    );
  }

  return (
    <>
      <StatusBar
        barStyle={colors.statusBarStyle}
        backgroundColor={colors.background}
      />
      <NavigationContainer ref={navigationRef} theme={navigationTheme}>
        <Stack.Navigator
          screenLayout={renderResponsiveScreen}
          initialRouteName={
            currentSession?.x_omi_payload ? 'Home' : namer.navigation.login
          }
        >
          {!currentSession?.x_omi_payload ? (
            <>
              <Stack.Screen
                name={namer.navigation.login}
                component={Auth_Login}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name={namer.navigation.signup}
                component={Auth_Signup}
                options={{ headerShown: false }}
              />
            </>
          ) : (
            <>
              <Stack.Screen
                name="Home"
                component={BottomTabNavigator}
                options={{ headerShown: false }}
                // The tabs centre their own screens; the tab bar stays full width
                layout={({ children }) => children}
              />
              <Stack.Screen
                name={namer.navigation.conversation}
                component={Screen_conversation}
                options={{ headerBackTitle: '' }}
              />
              <Stack.Screen
                name={namer.navigation.editprofile}
                component={Screen_editprofile}
                options={{ headerBackTitle: '' }}
              />
              <Stack.Screen
                name={namer.navigation.editProfilePrompts}
                component={Screen_editProfilePrompts}
                options={{ headerBackTitle: '' }}
              />
              <Stack.Screen
                name={namer.navigation.editProfileInterests}
                component={Screen_editProfileInterests}
                options={{ headerBackTitle: '' }}
              />
              <Stack.Screen
                name={namer.navigation.editLocation}
                component={Screen_editProfileLocation}
                options={{ headerBackTitle: '' }}
              />
              <Stack.Screen
                name={namer.navigation.verifyProfile}
                component={Screen_profileVerify}
                options={{ headerBackTitle: '' }}
              />
              <Stack.Screen
                name={namer.navigation.editpreference}
                component={Screen_editpreference}
              />
              <Stack.Screen
                name={namer.navigation.peoplesOnePerson}
                component={Peoples_Screen}
                options={{ headerBackTitle: '' }}
              />
              <Stack.Screen
                name={namer.navigation.myTimeline}
                component={Screen_feed}
                options={{ headerBackTitle: '' }}
              />
              <Stack.Screen
                name={namer.navigation.subscription}
                component={Screen_PurchaseSubscribe}
                options={{
                  headerTintColor: colors.text,
                  title: 'Upgrade Your Experience',
                  headerBackTitle: '',
                  headerTitleAlign: 'center',
                  headerTitleStyle: {
                    fontSize: 20,
                    fontWeight: 'bold',
                    color: colors.text,
                    fontFamily: 'Helvetica',
                  },
                  headerShadowVisible: false,
                  headerStyle: { backgroundColor: colors.background },
                }}
              />
              <Stack.Screen
                name={namer.navigation.consumables}
                component={Screen_PurchaseConsumable}
                options={{
                  headerTintColor: colors.text,
                  title: 'Upgrade Your Experience',
                  headerBackTitle: '',
                  headerTitleAlign: 'center',
                  headerTitleStyle: {
                    fontSize: 20,
                    fontWeight: 'bold',
                    color: colors.text,
                    fontFamily: 'Helvetica',
                  },
                  headerShadowVisible: false,
                  headerStyle: { backgroundColor: colors.background },
                }}
              />
              <Stack.Screen
                name={namer.navigation.settings}
                component={Screen_settings}
                options={{ headerBackTitle: '' }}
              />
              <Stack.Screen
                name={namer.navigation.notificationSettings}
                component={Screen_notificationSettings}
                options={{ headerBackTitle: '' }}
              />
            </>
          )}
          <Stack.Screen
            name={namer.navigation.devpage}
            component={Zz_devv}
            options={{}}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
};

const App = () => (
  <ThemeProvider>
    <UnitsProvider>
      <SafeAreaProvider style={{ flex: 1, position: 'relative' }}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <BottomSheetModalProvider>
            <Loaderx />
            <MainApp />
            <Toastx />
            <Dialogx />
          </BottomSheetModalProvider>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </UnitsProvider>
  </ThemeProvider>
);

export default App;
