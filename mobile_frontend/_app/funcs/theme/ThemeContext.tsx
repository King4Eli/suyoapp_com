import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { namer } from '../static';
import { ThemeColors, palettes } from './palette';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedScheme = 'light' | 'dark';

type ThemeContextValue = {
  mode: ThemeMode;
  resolvedScheme: ResolvedScheme;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => void;
  isReady: boolean;
};

const resolveScheme = (
  mode: ThemeMode,
  systemScheme: ColorSchemeName | null | undefined,
): ResolvedScheme => {
  if (mode === 'system') {
    return systemScheme === 'dark' ? 'dark' : 'light';
  }
  return mode;
};

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'system',
  resolvedScheme: 'light',
  colors: palettes.light,
  setMode: () => {},
  isReady: false,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [systemScheme, setSystemScheme] = useState<
    ColorSchemeName | null | undefined
  >(() => Appearance.getColorScheme());
  const [isReady, setIsReady] = useState(false);

  // Load the persisted preference once on mount.
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(namer.storage.themeMode);
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setModeState(stored);
        }
      } catch {
        // fall back to 'system' if storage read fails
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  // Track live system appearance changes (only matters while mode === 'system',
  // but it's cheap to always keep this current).
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme);
    });
    return () => sub.remove();
  }, []);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    AsyncStorage.setItem(namer.storage.themeMode, newMode).catch(() => {});
  };

  const resolvedScheme = resolveScheme(mode, systemScheme);
  const colors = palettes[resolvedScheme];

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      resolvedScheme,
      colors,
      setMode,
      isReady,
    }),
    [mode, resolvedScheme, colors, isReady],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
