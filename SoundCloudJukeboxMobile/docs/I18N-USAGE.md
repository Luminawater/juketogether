# i18n Usage Guide

## ✅ Implementation Complete

The i18n system is now fully set up with **10 languages**:
- 🇺🇸 English (en)
- 🇪🇸 Spanish (es)
- 🇳🇴 Norwegian (no)
- 🇫🇷 French (fr)
- 🇩🇪 German (de)
- 🇰🇷 Korean (ko)
- 🇨🇳 Chinese (zh)
- 🇸🇦 Arabic (ar)
- 🇯🇵 Japanese (ja)
- 🇵🇹 Portuguese (pt)

## 📁 File Structure

```
src/
  locales/
    en/
      common.json    # Buttons, labels, general UI
      screens.json   # Screen-specific text
      errors.json    # Error messages
    es/ ... (same structure)
    no/ ... (same structure)
    ... (all 10 languages)
  config/
    i18n.ts          # i18n configuration
  context/
    LanguageContext.tsx  # Language context with i18next integration
```

## 🚀 How to Use Translations

### Method 1: Using the Language Context (Recommended)

```typescript
import { useLanguage } from '../context/LanguageContext';

const MyComponent = () => {
  const { t } = useLanguage();
  
  return (
    <Text>{t('common:buttons.createRoom')}</Text>
    <Text>{t('screens:dashboard.title')}</Text>
    <Text>{t('errors:auth.invalidCredentials')}</Text>
  );
};
```

### Method 2: Using useTranslation Hook Directly

```typescript
import { useTranslation } from 'react-i18next';

const MyComponent = () => {
  const { t } = useTranslation('common');
  
  return (
    <Text>{t('buttons.createRoom')}</Text>
    <Text>{t('navigation.dashboard')}</Text>
  );
};
```

### Method 3: With Namespace

```typescript
import { useTranslation } from 'react-i18next';

const MyComponent = () => {
  const { t } = useTranslation(['common', 'screens']);
  
  return (
    <Text>{t('common:buttons.createRoom')}</Text>
    <Text>{t('screens:dashboard.title')}</Text>
  );
};
```

## 📝 Translation Key Format

### Namespaces
- `common` - General UI elements (buttons, labels, messages)
- `screens` - Screen-specific content
- `errors` - Error messages

### Key Structure
```
namespace:category.key
```

Examples:
- `common:buttons.createRoom`
- `screens:dashboard.title`
- `errors:auth.invalidCredentials`

## 🔄 Changing Language

The language selector in the drawer automatically updates all translations:

```typescript
import { useLanguage } from '../context/LanguageContext';

const MyComponent = () => {
  const { language, setLanguage, supportedLanguages } = useLanguage();
  
  // Change language programmatically
  const changeToSpanish = async () => {
    const spanish = supportedLanguages.find(l => l.code === 'es');
    if (spanish) {
      await setLanguage(spanish);
    }
  };
  
  return (
    <Text>Current language: {language.name}</Text>
  );
};
```

## 🌐 Interpolation (Dynamic Values)

```typescript
// In translation file: "minutesAgo": "{{count}} minute ago"
const { t } = useLanguage();
<Text>{t('common:time.minutesAgo', { count: 5 })}</Text>
// Output: "5 minutes ago"
```

## 📦 Adding New Translations

1. **Add to English first** (`src/locales/en/common.json`):
```json
{
  "newSection": {
    "newKey": "New Translation"
  }
}
```

2. **Translate to all languages** in their respective files

3. **Use in component**:
```typescript
const { t } = useLanguage();
<Text>{t('common:newSection.newKey')}</Text>
```

## ✅ Features

- ✅ Automatic language detection from device
- ✅ Language preference saved to AsyncStorage
- ✅ Language preference synced to Supabase (if logged in)
- ✅ Language selector in drawer
- ✅ All 10 languages fully translated
- ✅ Organized by namespaces (common, screens, errors)
- ✅ Type-safe (TypeScript)
- ✅ Works offline (local JSON files)
- ✅ SEO-friendly (content in HTML at build time)

## 🎯 Next Steps

1. Start using `t()` function in components
2. Replace hardcoded strings with translation keys
3. Add more translations as needed
4. Consider adding Supabase integration for dynamic content later

