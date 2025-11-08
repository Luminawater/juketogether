# i18n Implementation Guide

## Step 1: Install react-i18next

```bash
cd SoundCloudJukeboxMobile
npm install react-i18next i18next
npm install --save-dev @types/react-i18next
```

## Step 2: Create Translation Files Structure

```
src/
  locales/
    en/
      common.json
      screens.json
      errors.json
    es/
      common.json
      screens.json
      errors.json
    fr/
      common.json
      screens.json
      errors.json
    ... (all 12 languages)
```

## Step 3: Setup i18next Configuration

Create `src/config/i18n.ts`:

```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';

// Import translations
import enCommon from '../locales/en/common.json';
import enScreens from '../locales/en/screens.json';
import esCommon from '../locales/es/common.json';
import esScreens from '../locales/es/screens.json';
// ... import all languages

const resources = {
  en: {
    common: enCommon,
    screens: enScreens,
  },
  es: {
    common: esCommon,
    screens: esScreens,
  },
  // ... add all languages
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en', // default language
    fallbackLng: 'en',
    defaultNS: 'common',
    interpolation: {
      escapeValue: false, // React already escapes
    },
    compatibilityJSON: 'v3', // For React Native
  });

// Detect and set language from device
const detectLanguage = async () => {
  try {
    // Check saved preference first
    const savedLang = await AsyncStorage.getItem('@juketogether:language');
    if (savedLang && resources[savedLang as keyof typeof resources]) {
      await i18n.changeLanguage(savedLang);
      return;
    }

    // Fallback to device language
    const deviceLang = Localization.locale.split('-')[0];
    if (resources[deviceLang as keyof typeof resources]) {
      await i18n.changeLanguage(deviceLang);
    }
  } catch (error) {
    console.error('Error detecting language:', error);
  }
};

detectLanguage();

export default i18n;
```

## Step 4: Update LanguageContext to Use i18next

Modify `src/context/LanguageContext.tsx`:

```typescript
import { useLanguage as useI18nLanguage } from '../config/i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../config/i18n';

// Keep existing SUPPORTED_LANGUAGES array

export const useLanguage = () => {
  const { language, setLanguage, supportedLanguages } = useLanguageContext();
  
  const changeLanguage = async (langCode: string) => {
    await i18n.changeLanguage(langCode);
    await AsyncStorage.setItem('@juketogether:language', langCode);
    const selectedLang = SUPPORTED_LANGUAGES.find(l => l.code === langCode);
    if (selectedLang) {
      await setLanguage(selectedLang);
    }
  };

  return {
    language,
    setLanguage: changeLanguage,
    supportedLanguages,
    t: i18n.t, // Translation function
  };
};
```

## Step 5: Use Translations in Components

```typescript
import { useTranslation } from 'react-i18next';

const MyComponent = () => {
  const { t } = useTranslation('common');
  
  return (
    <Text>{t('welcome')}</Text>
    <Button>{t('buttons.createRoom')}</Button>
  );
};
```

## Step 6: Add Language Prefix to URLs (Web SEO)

Update `App.tsx` linking config:

```typescript
const linking = {
  prefixes: [
    Linking.createURL('/'),
    ...(Platform.OS === 'web' ? ['/'] : []),
  ],
  config: {
    screens: {
      Home: ':locale?', // Optional locale prefix
      Dashboard: ':locale?/dashboard',
      Room: ':locale?/room/:roomId',
      // ... other screens
    },
  },
};
```

## Step 7: Create Translation Files

Example `src/locales/en/common.json`:

```json
{
  "welcome": "Welcome",
  "buttons": {
    "createRoom": "Create Room",
    "joinRoom": "Join Room",
    "signOut": "Sign Out"
  },
  "navigation": {
    "dashboard": "Dashboard",
    "discovery": "Discover Rooms",
    "leaderboard": "Leaderboard"
  }
}
```

Example `src/locales/es/common.json`:

```json
{
  "welcome": "Bienvenido",
  "buttons": {
    "createRoom": "Crear Sala",
    "joinRoom": "Unirse a Sala",
    "signOut": "Cerrar Sesión"
  },
  "navigation": {
    "dashboard": "Panel",
    "discovery": "Descubrir Salas",
    "leaderboard": "Clasificación"
  }
}
```

## Step 8: Add SEO Meta Tags (Web Only)

Create `src/components/SEOHead.tsx`:

```typescript
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useTranslation } from 'react-i18next';

export const SEOHead = () => {
  const { i18n } = useTranslation();
  const currentLang = i18n.language;

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      // Add hreflang tags
      const supportedLangs = ['en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'pl', 'ru', 'ja', 'ko', 'zh'];
      
      supportedLangs.forEach(lang => {
        const link = document.createElement('link');
        link.rel = 'alternate';
        link.hreflang = lang;
        link.href = `https://juketogether.com/${lang === 'en' ? '' : lang + '/'}${window.location.pathname.replace(/^\/[a-z]{2}\//, '')}`;
        document.head.appendChild(link);
      });

      // Set HTML lang attribute
      document.documentElement.lang = currentLang;
    }
  }, [currentLang]);

  return null;
};
```

## Step 9: Optional - Supabase Integration for Dynamic Content

Create `src/services/translationService.ts`:

```typescript
import { supabase } from '../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const loadRemoteTranslations = async (langCode: string) => {
  try {
    // Check cache first
    const cached = await AsyncStorage.getItem(`@translations:${langCode}`);
    const cacheTime = await AsyncStorage.getItem(`@translations:${langCode}:time`);
    
    // Use cache if less than 24 hours old
    if (cached && cacheTime) {
      const age = Date.now() - parseInt(cacheTime);
      if (age < 24 * 60 * 60 * 1000) {
        return JSON.parse(cached);
      }
    }

    // Fetch from Supabase
    const { data, error } = await supabase
      .from('translations')
      .select('*')
      .eq('language', langCode);

    if (error) throw error;

    // Cache translations
    await AsyncStorage.setItem(`@translations:${langCode}`, JSON.stringify(data));
    await AsyncStorage.setItem(`@translations:${langCode}:time`, Date.now().toString());

    return data;
  } catch (error) {
    console.error('Error loading remote translations:', error);
    return null;
  }
};
```

---

## Migration Strategy

1. **Phase 1**: Set up i18next with English only (1-2 days)
2. **Phase 2**: Translate to top 3 languages (Spanish, French, German) (1 week)
3. **Phase 3**: Add remaining languages (1-2 weeks)
4. **Phase 4**: Add Supabase for dynamic content (optional, 2-3 days)
5. **Phase 5**: SEO optimization with URL prefixes (1-2 days)

---

## Best Practices

1. **Use namespaces** to organize translations (common, screens, errors)
2. **Keep keys consistent** across all languages
3. **Use interpolation** for dynamic values: `t('welcome', { name: user.name })`
4. **Test all languages** to ensure UI doesn't break with longer text
5. **Consider RTL languages** (Arabic, Hebrew) if targeting those markets
6. **Use professional translators** for important content (not Google Translate)

