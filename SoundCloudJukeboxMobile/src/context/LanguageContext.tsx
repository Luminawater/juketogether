import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { useAuth } from './AuthContext';
import i18n from '../config/i18n';

export type Language = {
  code: string;
  name: string;
  flag: string;
  locale: string;
};

// Supported languages - only the requested ones
export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en', name: 'English', flag: '🇺🇸', locale: 'en-US' },
  { code: 'es', name: 'Español', flag: '🇪🇸', locale: 'es-ES' },
  { code: 'no', name: 'Norsk', flag: '🇳🇴', locale: 'no-NO' },
  { code: 'fr', name: 'Français', flag: '🇫🇷', locale: 'fr-FR' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪', locale: 'de-DE' },
  { code: 'ko', name: '한국어', flag: '🇰🇷', locale: 'ko-KR' },
  { code: 'zh', name: '中文', flag: '🇨🇳', locale: 'zh-CN' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦', locale: 'ar-SA' },
  { code: 'ja', name: '日本語', flag: '🇯🇵', locale: 'ja-JP' },
  { code: 'pt', name: 'Português', flag: '🇵🇹', locale: 'pt-PT' },
];

const LANGUAGE_STORAGE_KEY = '@juketogether:language';
const DEFAULT_LANGUAGE = 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => Promise<void>;
  supportedLanguages: Language[];
  t: (key: string, options?: any) => string; // Translation function from i18next
  i18n: typeof i18n; // i18n instance for advanced usage
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const { user, profile, supabase } = useAuth();
  const { t } = useTranslation(); // Safe to use - i18n is initialized in App.tsx
  const [language, setLanguageState] = useState<Language>(
    SUPPORTED_LANGUAGES.find((lang) => lang.code === DEFAULT_LANGUAGE) || SUPPORTED_LANGUAGES[0]
  );
  const [isLoading, setIsLoading] = useState(true);

  // Sync i18n language with context language
  useEffect(() => {
    if (i18n.language !== language.code) {
      i18n.changeLanguage(language.code);
    }
  }, [language.code]);

  // Load language preference from Supabase (if logged in) or AsyncStorage (if not logged in)
  useEffect(() => {
    const loadLanguage = async () => {
      try {
        setIsLoading(true);
        let languageCode: string | null = null;

        // If user is logged in, try to load from Supabase profile first
        if (user && profile) {
          languageCode = profile.language || null;
        }

        // If no language in Supabase, try AsyncStorage
        if (!languageCode) {
          languageCode = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
        }

        // If still no language, check i18n's detected language
        if (!languageCode) {
          languageCode = i18n.language || DEFAULT_LANGUAGE;
        }

        // Find and set the language
        const savedLanguage = SUPPORTED_LANGUAGES.find(
          (lang) => lang.code === languageCode
        );
        if (savedLanguage) {
          setLanguageState(savedLanguage);
          await i18n.changeLanguage(savedLanguage.code);
        } else {
          // Fallback to default if language code is invalid
          const defaultLang = SUPPORTED_LANGUAGES.find(
            (lang) => lang.code === DEFAULT_LANGUAGE
          ) || SUPPORTED_LANGUAGES[0];
          setLanguageState(defaultLang);
          await i18n.changeLanguage(defaultLang.code);
        }
      } catch (error) {
        console.error('Error loading language preference:', error);
        // Fallback to default on error
        const defaultLang = SUPPORTED_LANGUAGES.find(
          (lang) => lang.code === DEFAULT_LANGUAGE
        ) || SUPPORTED_LANGUAGES[0];
        setLanguageState(defaultLang);
        i18n.changeLanguage(defaultLang.code);
      } finally {
        setIsLoading(false);
      }
    };

    loadLanguage();
  }, [user, profile]);

  const setLanguage = async (newLanguage: Language) => {
    try {
      // Always save to AsyncStorage as backup
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, newLanguage.code);
      setLanguageState(newLanguage);
      
      // Update i18n language
      await i18n.changeLanguage(newLanguage.code);

      // If user is logged in, also save to Supabase
      if (user && supabase) {
        const { error } = await supabase
          .from('user_profiles')
          .update({ language: newLanguage.code })
          .eq('id', user.id);

        if (error) {
          console.error('Error saving language to Supabase:', error);
          // Language is still saved to AsyncStorage, so continue
        }
      }
    } catch (error) {
      console.error('Error saving language preference:', error);
    }
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        supportedLanguages: SUPPORTED_LANGUAGES,
        t,
        i18n,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

