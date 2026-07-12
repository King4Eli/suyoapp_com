import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import IIcon from 'react-native-vector-icons/Ionicons';
import { _http_request, hostServer } from '../funcs/functions';
import { Toastx } from '../funcs/customNotification';
import { MAX_INTERESTS, InterestEntry } from './ProfileEdit';

type InterestGroup = { category: string; items: Array<{ id_ai: number; interested_in: string }> };

export function Screen_editProfileInterests({ navigation, route }: { navigation: any; route: any }) {
    const existingInterests: InterestEntry[] = route.params?.existingInterests ?? [];
    const onSave: ((updated: InterestEntry[]) => void) | undefined = route.params?.onSave;

    const [interests, setInterests] = useState<InterestEntry[]>(existingInterests);
    const [groups, setGroups] = useState<InterestGroup[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const returnWithUpdates = useCallback(() => {
        onSave?.(interests);
        navigation.goBack();
    }, [navigation, onSave, interests]);

    useLayoutEffect(() => {
        navigation.setOptions({
            headerTitle: () => <Text style={styles.headerTitle}>Interests</Text>,
            headerLeft: () => (
                <Pressable style={styles.headerButton} onPress={returnWithUpdates} hitSlop={10}>
                    <IIcon name="chevron-back" size={24} color="#0f172a" />
                </Pressable>
            ),
            headerRight: () => (
                <Pressable style={styles.headerButton} onPress={returnWithUpdates} hitSlop={10}>
                    <Text style={styles.doneText}>Done</Text>
                </Pressable>
            ),
        });
    }, [navigation, returnWithUpdates]);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const response = await _http_request({
                    customApiUrl: hostServer() + '/api/core/v1/getInterests',
                    reqType: 'POST',
                });
                if (mounted && Array.isArray(response?.interests)) {
                    setGroups(response.interests);
                }
            } catch (error) {
                console.error('Error loading interests:', error);
            } finally {
                if (mounted) setIsLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, []);

    const toggleInterest = (item: { id_ai: number; interested_in: string }) => {
        setInterests(prev => {
            if (prev.some(v => v.id_ai === item.id_ai)) return prev.filter(v => v.id_ai !== item.id_ai);
            if (prev.length >= MAX_INTERESTS) {
                Toastx.show({ message: `Max ${MAX_INTERESTS} interests allowed.`, type: 'info' });
                return prev;
            }
            return [...prev, item];
        });
    };

    return (
        <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
            <View style={styles.header}>
                <Text style={styles.countBadge}>{interests.length}/{MAX_INTERESTS} selected</Text>
            </View>
            {isLoading ? (
                <ActivityIndicator style={{ marginTop: 24 }} color="#e8546f" />
            ) : (
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    {groups.map(({ category, items }) => (
                        <View key={category} style={styles.interestCategory}>
                            <Text style={styles.interestCategoryTitle}>{category}</Text>
                            <View style={styles.chipRow}>
                                {items.map((item) => {
                                    const selected = interests.some(v => v.id_ai === item.id_ai);
                                    return (
                                        <TouchableOpacity
                                            key={item.id_ai}
                                            style={[styles.chip, selected && styles.chipSelected]}
                                            onPress={() => toggleInterest(item)}
                                            activeOpacity={0.75}
                                        >
                                            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                                                {item.interested_in}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    ))}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#f8fafc' },
    header: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        paddingHorizontal: 18,
        paddingTop: 12,
    },
    headerTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
    headerButton: { paddingHorizontal: 12, paddingVertical: 6 },
    doneText: { fontSize: 15, fontWeight: '900', color: '#e8546f' },
    countBadge: { color: '#94a3b8', fontSize: 12, fontWeight: '800' },
    scrollContent: { padding: 18, gap: 12, paddingBottom: 40 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 2 },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    chipSelected: { backgroundColor: '#e8546f', borderColor: '#e8546f' },
    chipText: { fontSize: 13, color: '#334155', fontWeight: '800' },
    chipTextSelected: { color: '#fff', fontWeight: '900' },
    interestCategory: {
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 12,
        gap: 8,
    },
    interestCategoryTitle: {
        color: '#0f172a',
        fontSize: 15,
        fontWeight: '900',
    },
});
