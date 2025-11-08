import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';

// Import translations - Common namespace
import enCommon from '../locales/en/common.json';
import esCommon from '../locales/es/common.json';
import noCommon from '../locales/no/common.json';
import frCommon from '../locales/fr/common.json';
import deCommon from '../locales/de/common.json';
import koCommon from '../locales/ko/common.json';
import zhCommon from '../locales/zh/common.json';
import arCommon from '../locales/ar/common.json';
import jaCommon from '../locales/ja/common.json';
import ptCommon from '../locales/pt/common.json';

// Import translations - Screens namespace
import enScreens from '../locales/en/screens.json';
import esScreens from '../locales/es/screens.json';
import noScreens from '../locales/no/screens.json';
import frScreens from '../locales/fr/screens.json';
import deScreens from '../locales/de/screens.json';
import koScreens from '../locales/ko/screens.json';
import zhScreens from '../locales/zh/screens.json';
import arScreens from '../locales/ar/screens.json';
import jaScreens from '../locales/ja/screens.json';
import ptScreens from '../locales/pt/screens.json';

// Import translations - Errors namespace
import enErrors from '../locales/en/errors.json';
import esErrors from '../locales/es/errors.json';
import noErrors from '../locales/no/errors.json';
import frErrors from '../locales/fr/errors.json';
import deErrors from '../locales/de/errors.json';
import koErrors from '../locales/ko/errors.json';
import zhErrors from '../locales/zh/errors.json';
import arErrors from '../locales/ar/errors.json';
import jaErrors from '../locales/ja/errors.json';
import ptErrors from '../locales/pt/errors.json';

const resources = {
  en: {
    common: enCommon,
    screens: enScreens,
    errors: enErrors,
  },
  es: {
    common: esCommon,
    screens: esScreens,
    errors: esErrors,
  },
  no: {
    common: noCommon,
    screens: noScreens,
    errors: noErrors,
  },
  fr: {
    common: frCommon,
    screens: frScreens,
    errors: frErrors,
  },
  de: {
    common: deCommon,
    screens: deScreens,
    errors: deErrors,
  },
  ko: {
    common: koCommon,
    screens: koScreens,
    errors: koErrors,
  },
  zh: {
    common: zhCommon,
    screens: zhScreens,
    errors: zhErrors,
  },
  ar: {
    common: arCommon,
    screens: arScreens,
    errors: arErrors,
  },
  ja: {
    common: jaCommon,
    screens: jaScreens,
    errors: jaErrors,
  },
  pt: {
    common: ptCommon,
    screens: ptScreens,
    errors: ptErrors,
  },
};

const LANGUAGE_STORAGE_KEY = '@juketogether:language';

// Detect and set language from device or saved preference
const detectLanguage = async (): Promise<string> => {
  try {
    // Check saved preference first
    const savedLang = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (savedLang && resources[savedLang as keyof typeof resources]) {
      return savedLang;
    }

    // Fallback to device language
    const deviceLang = Localization.locale.split('-')[0];
    if (resources[deviceLang as keyof typeof resources]) {
      return deviceLang;
    }

    // Fallback to device locale (e.g., 'en-US' -> 'en')
    const deviceLocale = Localization.locale.split('-')[0];
    if (resources[deviceLocale as keyof typeof resources]) {
      return deviceLocale;
    }
  } catch (error) {
    console.error('Error detecting language:', error);
  }

  // Default to English
  return 'en';
};

// Initialize i18n
i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en', // Will be set by detectLanguage
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'screens', 'errors'],
    interpolation: {
      escapeValue: false, // React already escapes
    },
    compatibilityJSON: 'v3', // For React Native
    react: {
      useSuspense: false, // Disable suspense for React Native
    },
  });

// Set language after initialization
detectLanguage().then((lang) => {
  i18n.changeLanguage(lang);
});

export default i18n;

