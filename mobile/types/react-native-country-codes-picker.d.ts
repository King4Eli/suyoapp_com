// Local type stub for react-native-country-codes-picker.
// The published package ships untyped .tsx source (`main: index.tsx`, no `types`
// field) which fails `tsc --noEmit` under this project's strict config. This
// declaration shadows it via `compilerOptions.paths` in tsconfig.json.
declare module 'react-native-country-codes-picker' {
  import * as React from 'react';
  import { StyleProp, ViewStyle, TextStyle } from 'react-native';

  export interface CountryItem {
    name: Record<string, string> | string;
    dial_code: string;
    code: string;
    flag: string;
  }

  export interface CountryPickerProps {
    show: boolean;
    pickerButtonOnPress: (item: CountryItem) => void;
    lang?: string;
    inputPlaceholder?: string;
    searchMessage?: string;
    onBackdropPress?: () => void;
    disableBackdrop?: boolean;
    enableModalAvoiding?: boolean;
    androidWindowSoftInputMode?: string;
    onFinishInitialization?: () => void;
    excludedCountries?: string[];
    showOnly?: string[];
    popularCountries?: string[];
    style?: {
      modal?: StyleProp<ViewStyle>;
      backdrop?: StyleProp<ViewStyle>;
      line?: StyleProp<ViewStyle>;
      itemsList?: StyleProp<ViewStyle>;
      textInput?: StyleProp<TextStyle>;
      countryButtonStyles?: StyleProp<ViewStyle>;
      searchMessageText?: StyleProp<TextStyle>;
      countryMessageContainer?: StyleProp<ViewStyle>;
      flag?: StyleProp<TextStyle>;
      dialCode?: StyleProp<TextStyle>;
      countryName?: StyleProp<TextStyle>;
    };
  }

  export const CountryPicker: React.ComponentType<CountryPickerProps>;
  export const CountryButton: React.ComponentType<any>;
  export function countryCodes(): CountryItem[];
}
