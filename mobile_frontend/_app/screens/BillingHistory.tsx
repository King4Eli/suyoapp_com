import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LottieView from 'lottie-react-native';
import { _http_request, hostServer } from '../funcs/functions';
import { resourceMap } from '../funcs/static';

const STATUS_UI: Record<number, { label: string; color: string; bg: string }> = {
    0: { label: 'Pending', color: '#92400e', bg: '#fef3c7' },
    1: { label: 'Completed', color: '#166534', bg: '#dcfce7' },
    2: { label: 'Refunded', color: '#1e40af', bg: '#dbeafe' },
    3: { label: 'Failed', color: '#991b1b', bg: '#fee2e2' },
    4: { label: 'Expired', color: '#475569', bg: '#f1f5f9' },
};

const getStatusUi = (status: number) => STATUS_UI[status] ?? { label: 'Unknown', color: '#475569', bg: '#f1f5f9' };

const formatDate = (value: string) =>
    value
        ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
        : '';

export const Screen_BillingHistory = () => {
    const [history, setHistory] = useState<any[] | null>(null);

    useFocusEffect(
        useCallback(() => {
            let mounted = true;
            _http_request({
                reqType: 'POST',
                customApiUrl: `${hostServer()}/api/core/v1/getPaymentHistory`,
            }).then((response: any) => {
                if (!mounted) return;
                setHistory(Array.isArray(response?.history) ? response.history : []);
            });
            return () => {
                mounted = false;
            };
        }, []),
    );

    if (history === null) {
        return (
            <View style={stylesx.loadingWrap}>
                <LottieView source={resourceMap.lottie.infinityLoading} autoPlay loop style={{ width: 160, height: 160 }} />
            </View>
        );
    }

    return (
        <SafeAreaView style={stylesx.container} edges={['bottom']}>
            <FlatList
                data={history}
                keyExtractor={(item) => item.paymentId}
                contentContainerStyle={stylesx.listContent}
                ListEmptyComponent={
                    <View style={stylesx.emptyWrap}>
                        <Text style={stylesx.emptyText}>No payments yet.</Text>
                    </View>
                }
                renderItem={({ item }) => {
                    const statusUi = getStatusUi(item.status);
                    return (
                        <View style={stylesx.row}>
                            <View style={{ flex: 1 }}>
                                <Text style={stylesx.rowTitle}>{item.productName ?? 'Purchase'}{item.planName ? ` · ${item.planName}` : ''}</Text>
                                <Text style={stylesx.rowDate}>{formatDate(item.createdAt)}</Text>
                            </View>
                            <View style={stylesx.rowRight}>
                                <Text style={stylesx.rowAmount}>{item.currency} {Number(item.amount).toFixed(2)}</Text>
                                <View style={[stylesx.statusPill, { backgroundColor: statusUi.bg }]}>
                                    <Text style={[stylesx.statusPillText, { color: statusUi.color }]}>{statusUi.label}</Text>
                                </View>
                            </View>
                        </View>
                    );
                }}
            />
        </SafeAreaView>
    );
};

const stylesx = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    loadingWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
    },
    listContent: {
        padding: 16,
        gap: 10,
    },
    emptyWrap: {
        paddingTop: 60,
        alignItems: 'center',
    },
    emptyText: {
        color: '#64748b',
        fontSize: 14,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 14,
        gap: 12,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
    },
    rowTitle: {
        color: '#0f172a',
        fontSize: 14,
        fontWeight: '700',
        textTransform: 'capitalize',
    },
    rowDate: {
        color: '#94a3b8',
        fontSize: 12,
        marginTop: 2,
    },
    rowRight: {
        alignItems: 'flex-end',
        gap: 6,
    },
    rowAmount: {
        color: '#0f172a',
        fontSize: 14,
        fontWeight: '700',
    },
    statusPill: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
    },
    statusPillText: {
        fontSize: 11,
        fontWeight: '700',
    },
});
