import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { namer } from './static';

// Display-only: the API always stores and filters in miles and centimetres;
// this just picks how distances and heights are written on screen. Kept on the
// device like the theme, not on the account.
export type UnitSystem = 'metric' | 'imperial';

const KM_PER_MILE = 1.60934;

export const formatDistance = (miles: unknown, unit: UnitSystem) => {
  const n = Number(miles);
  if (miles == null || miles === '' || !Number.isFinite(n)) return null;
  if (unit === 'metric') {
    const km = n * KM_PER_MILE;
    return km < 1 ? 'Less than a km away' : `${Math.round(km)} km away`;
  }
  return n < 1 ? 'Less than a mile away' : `${Math.round(n)} mi away`;
};

/** A distance limit, e.g. the "Up to …" preference label. */
export const formatDistanceLimit = (miles: number, unit: UnitSystem) =>
  unit === 'metric'
    ? `${Math.round(miles * KM_PER_MILE)} km`
    : `${miles} ${miles === 1 ? 'mile' : 'miles'}`;

export const formatHeight = (cm: unknown, unit: UnitSystem) => {
  const n = Number(cm);
  if (cm == null || cm === '' || !Number.isFinite(n) || n <= 0) return null;
  if (unit === 'metric') return `${Math.round(n)} cm`;
  const totalInches = Math.round(n / 2.54);
  return `${Math.floor(totalInches / 12)}'${totalInches % 12}"`;
};

type UnitsContextValue = {
  unit: UnitSystem;
  setUnit: (unit: UnitSystem) => void;
};

const UnitsContext = createContext<UnitsContextValue>({
  unit: 'imperial',
  setUnit: () => {},
});

export const UnitsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [unit, setUnitState] = useState<UnitSystem>('imperial');

  useEffect(() => {
    AsyncStorage.getItem(namer.storage.units)
      .then(stored => {
        if (stored === 'metric' || stored === 'imperial') setUnitState(stored);
      })
      .catch(() => {});
  }, []);

  const value = useMemo<UnitsContextValue>(
    () => ({
      unit,
      setUnit: next => {
        setUnitState(next);
        AsyncStorage.setItem(namer.storage.units, next).catch(() => {});
      },
    }),
    [unit],
  );

  return (
    <UnitsContext.Provider value={value}>{children}</UnitsContext.Provider>
  );
};

export const useUnits = () => useContext(UnitsContext);
