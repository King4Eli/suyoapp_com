import React, { useRef, useMemo, useState, useEffect } from 'react';
import { View, Text, Button, ScrollView, StyleSheet, Pressable, Linking, Clipboard } from 'react-native';
import { Toastx } from '../funcs/customNotification';
import { __init__app, cacheStorage, hostServer, llStorage, logReport } from '../funcs/functions';
import DeviceInfo from 'react-native-device-info';
import RNRestart from 'react-native-restart';
import { sessionManager } from '../funcs/SessionContext';


export function Zz_devv({ route, navigation }: { route: any, navigation: any }) {
    const __MAPPER = llStorage.CONFIG.get()?.mapper;
    const [getProfile, setProfile] = useState<any>(null);
    const getSession = sessionManager.getCurrentSession();

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const [userProfile] = await Promise.all([
                    cacheStorage.getCurrentUserProfile()
                ]);
                if (mounted) {
                    setProfile(userProfile);
                }
            } catch {
                if (mounted) {
                    setProfile(null);
                }
            }
        })();
        return () => { mounted = false; };
    }, []);
    return (
        <View style={{ flex: 1 }}>
            <Text style={{ backgroundColor: "#7eb400", color: "#fffdfd", padding: 10 }}>Debug Tools</Text>
            <ScrollView style={[{ flex: 1 }]} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 10, gap: 20 }}>
                <Pressable style={modernStyles.dangerSection} onPress={async () => {
                 
                    const [profile]=await Promise.all([
                        cacheStorage.getCurrentUserProfile(true),
                        cacheStorage.getProducts(true),
                        __init__app()
                    ]); 
                    setProfile(profile);
                    Toastx.show({ type: "info", message: "_ _init__app updated successfully" });
                }}>
                    <Text>reload update __init__app fun </Text>
                </Pressable>

                <Pressable style={modernStyles.dangerSection} onPress={() => { Linking.openURL(__MAPPER?.img_domain[0]); }}>
                    <Text>Image url: {__MAPPER?.img_domain[0]}</Text>
                </Pressable>

                <Pressable style={modernStyles.dangerSection} onPress={async () => { console.log("uyuu", await cacheStorage.getProducts(true)) }}>
                    <Text>getProducts</Text>
                </Pressable>

                <Pressable style={modernStyles.dangerSection} onPress={async () => {
                    Linking.openURL(
                        hostServer() + '/admin/admin_user_detail.php?id=' + getProfile?.profile?.id
                    );
                }}>
                    <Text>Profile admin url: {hostServer()}{"\n"}[uid: {getProfile?.profile?.id}]</Text>
                </Pressable>

                <Pressable style={modernStyles.dangerSection} onPress={async () => {
                    Clipboard.setString(getSession?.x_omi_payload + "\n" + getSession?.x_omi_payload_hash);
                }}>
                    <Text>session id: {getSession?.x_omi_payload} </Text>
                    <Text>session hash: {getSession?.x_omi_payload_hash} </Text>
                </Pressable>

                <Pressable style={modernStyles.dangerSection} onPress={() => {
                    RNRestart.restart();
                }}>
                    <Text>reload app</Text>
                </Pressable>

                <Pressable style={modernStyles.dangerSection} onPress={async () => {
                    logReport({
                        type: "tESTING",
                        extra: "Empty",
                        useraction: "Dev Tool",
                        url: "null",
                        logMessage: "string",
                        stackTrace: null,
                    });
                }}>
                    <Text>Test Log function</Text>
                </Pressable>

                <Pressable style={modernStyles.dangerSection} onPress={async () => {
                    navigation.navigate("zz_nofile");
                }}>
                    <Text>Testing null page</Text>
                </Pressable>

                <View style={modernStyles.dangerSection}>
                    <Text>\*** bundle ID: {DeviceInfo.getBundleId()}</Text>
                    <Text>\*** display name: {DeviceInfo.getApplicationName()}</Text>
                </View>


            </ScrollView>
        </View >

    );
}
// Modern Styles
const modernStyles = StyleSheet.create({

    dangerSection: {
        borderColor: "#ff4e42",
        borderWidth: 1,
        borderRadius: 15,
        padding: 12
    },
});
