import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
    View, Text, TextInput, Pressable,
    StyleSheet, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import IIcon from 'react-native-vector-icons/Ionicons';
import { useStableHeaderHeight } from '../funcs/useStableHeaderHeight';
import { _http_request } from '../funcs/functions';
import { __CONFIG__ } from '../funcs/static';
import { MAX_PROMPTS, PromptEntry } from './ProfileEdit';
import { useTheme, ThemeColors } from '../funcs/theme';

export function Screen_editProfilePrompts({ navigation, route }: { navigation: any; route: any }) {
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const headerHeight = useStableHeaderHeight();
    const existingPrompts: PromptEntry[] = route.params?.existingPrompts ?? [];
    const onSave: ((updated: PromptEntry[]) => void) | undefined = route.params?.onSave;

    const [prompts, setPrompts] = useState<PromptEntry[]>(existingPrompts);
    const [availablePrompts, setAvailablePrompts] = useState<Array<{ id_ai: number; question: string }>>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    const returnWithUpdates = useCallback(() => {
        onSave?.(prompts);
        navigation.goBack();
    }, [navigation, onSave, prompts]);

    useLayoutEffect(() => {
        navigation.setOptions({
            headerTitle: () => <Text style={styles.headerTitle}>Prompts</Text>,
            headerLeft: () => (
                <Pressable style={styles.headerButton} onPress={returnWithUpdates} hitSlop={10}>
                    <IIcon name="chevron-back" size={24} color={colors.text} />
                </Pressable>
            ),
            headerRight: () => (
                <Pressable style={styles.headerButton} onPress={returnWithUpdates} hitSlop={10}>
                    <Text style={styles.doneText}>Done</Text>
                </Pressable>
            ),
        });
    }, [navigation, returnWithUpdates]);

    const loadMore = useCallback(async (excludeIds: number[]) => {
        setIsLoading(true);
        try {
            const response = await _http_request({
                customApiUrl: __CONFIG__.HTTPS_API_DOMAIN + '/api/core/v1/getPrompts',
                reqType: 'POST',
                bodyArray: { excludeIds },
            });
            const fetched = Array.isArray(response?.prompts) ? response.prompts : [];
            setAvailablePrompts(prev => [...prev, ...fetched]);
            if (fetched.length === 0) setHasMore(false);
        } catch (error) {
            console.error('Error loading prompts:', error);
            setHasMore(false);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadMore(prompts.map(p => p.id_ai));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const removePrompt = (index: number) => {
        setPrompts(prev => prev.filter((_, i) => i !== index));
    };

    const savePrompt = (question: { id_ai: number; question: string }, answer: string) => {
        if (prompts.some(p => p.id_ai === question.id_ai) || !answer.trim()) return;
        setPrompts(prev => [...prev, { id_ai: question.id_ai, question: question.question, answer: answer.trim() }]);
    };

    const remainingPrompts = availablePrompts.filter(
        (p) => !prompts.some(sel => sel.id_ai === p.id_ai)
    );

    return (
        <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={headerHeight}
            >
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    {prompts.length > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.sectionLabel}>
                                Your Prompts
                                <Text style={styles.countBadge}> {prompts.length}/{MAX_PROMPTS}</Text>
                            </Text>
                            {prompts.map((item, index) => (
                                <View key={item.id_ai} style={styles.promptCard}>
                                    <Pressable
                                        style={styles.promptRemove}
                                        onPress={() => removePrompt(index)}
                                        hitSlop={6}
                                    >
                                        <IIcon name="close-circle" size={20} color={colors.danger} />
                                    </Pressable>
                                    <Text style={styles.promptQuestion}>{item.question}</Text>
                                    <TextInput
                                        style={[styles.textInput, styles.promptAnswer]}
                                        value={item.answer}
                                        placeholder={item.question}
                                        placeholderTextColor={colors.textTertiary}
                                        multiline
                                        maxLength={140}
                                        onChangeText={(text) => {
                                            setPrompts(prev => {
                                                const updated = [...prev];
                                                updated[index] = { ...updated[index], answer: text };
                                                return updated;
                                            });
                                        }}
                                    />
                                </View>
                            ))}
                        </View>
                    )}

                    {prompts.length < MAX_PROMPTS && (
                        <View style={styles.section}>
                            <Text style={styles.sectionLabel}>Add a Prompt</Text>
                            {remainingPrompts.map((question) => (
                                <PromptDraft key={question.id_ai} prompt={question.question} onSave={(answer) => savePrompt(question, answer)} colors={colors} styles={styles} />
                            ))}

                            {isLoading && <ActivityIndicator style={{ marginTop: 12 }} color={colors.primary} />}

                            {!isLoading && hasMore && (
                                <Pressable
                                    style={styles.loadMoreBtn}
                                    onPress={() => loadMore([...prompts.map(p => p.id_ai), ...availablePrompts.map(p => p.id_ai)])}
                                >
                                    <Text style={styles.loadMoreText}>Load More</Text>
                                </Pressable>
                            )}
                        </View>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const PromptDraft = ({ prompt, onSave, colors, styles }: { prompt: string; onSave: (answer: string) => void; colors: ThemeColors; styles: any }) => {
    const [text, setText] = useState('');

    return (
        <View style={styles.promptPickerCard}>
            <Text style={styles.promptQuestion}>{prompt}</Text>
            <TextInput
                style={[styles.textInput, styles.promptSheetInput]}
                value={text}
                onChangeText={setText}
                placeholder={prompt}
                placeholderTextColor={colors.textTertiary}
                maxLength={140}
                multiline
            />
            <Pressable
                style={[styles.saveBtn, !text.trim() && styles.saveBtnDisabled]}
                disabled={!text.trim()}
                onPress={() => onSave(text)}
            >
                <Text style={styles.saveBtnText}>Save Prompt</Text>
            </Pressable>
        </View>
    );
};

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.backgroundSecondary },
    scrollContent: { padding: 18, gap: 18, paddingBottom: 40 },
    headerTitle: { fontSize: 18, fontWeight: '900', color: colors.text },
    headerButton: { paddingHorizontal: 12, paddingVertical: 6 },
    doneText: { fontSize: 15, fontWeight: '900', color: colors.primary },
    section: { gap: 10 },
    sectionLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
    countBadge: { color: colors.textTertiary, fontSize: 12, fontWeight: '800' },
    textInput: {
        minHeight: 44,
        borderRadius: 14,
        backgroundColor: colors.backgroundSecondary,
        borderWidth: 1,
        borderColor: colors.border,
        color: colors.text,
        paddingHorizontal: 12,
        fontSize: 14,
    },
    promptCard: {
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        padding: 12,
        gap: 9,
        position: 'relative',
    },
    promptRemove: { position: 'absolute', top: 8, right: 8, zIndex: 10 },
    promptQuestion: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', color: colors.textSecondary, paddingRight: 28 },
    promptAnswer: {
        minHeight: 92,
        backgroundColor: colors.surface,
        textAlignVertical: 'top',
        lineHeight: 20,
        paddingTop: 12,
    },
    promptPickerCard: {
        borderRadius: 18,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 12,
        gap: 10,
        marginBottom: 10,
    },
    promptSheetInput: {
        minHeight: 90,
        backgroundColor: colors.backgroundSecondary,
        textAlignVertical: 'top',
        lineHeight: 20,
        paddingTop: 12,
    },
    saveBtn: {
        alignSelf: 'flex-end',
        backgroundColor: colors.primary,
        paddingHorizontal: 18,
        minHeight: 42,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveBtnDisabled: { opacity: 0.4 },
    saveBtnText: { color: '#fff', fontWeight: '900', fontSize: 14 },
    loadMoreBtn: {
        alignSelf: 'center',
        marginTop: 4,
        paddingHorizontal: 20,
        minHeight: 42,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.primary,
    },
    loadMoreText: { color: colors.primary, fontWeight: '900', fontSize: 14 },
    });
}
