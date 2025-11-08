import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Text, Menu, useTheme, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLanguage, Language } from '../context/LanguageContext';

interface LanguageSelectorProps {
  onLanguageChange?: (language: Language) => void;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ onLanguageChange }) => {
  const { language, setLanguage, supportedLanguages } = useLanguage();
  const theme = useTheme();
  const [menuVisible, setMenuVisible] = useState(false);

  const handleLanguageSelect = async (selectedLanguage: Language) => {
    await setLanguage(selectedLanguage);
    setMenuVisible(false);
    if (onLanguageChange) {
      onLanguageChange(selectedLanguage);
    }
  };

  return (
    <View style={styles.container}>
      <Menu
        visible={menuVisible}
        onDismiss={() => setMenuVisible(false)}
        anchor={
          <TouchableOpacity
            onPress={() => setMenuVisible(true)}
            activeOpacity={0.8}
            style={styles.selectorButtonContainer}
          >
            <LinearGradient
              colors={['#0a0a0a', '#1a1a1a', '#0f0f0f']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.selectorButton}
            >
              <Text style={[styles.flag, { fontSize: 20 }]}>{language.flag}</Text>
              <Text
                style={[
                  styles.languageName,
                  {
                    color: '#E0E0E0',
                  },
                ]}
              >
                {language.name}
              </Text>
              <MaterialCommunityIcons
                name="chevron-down"
                size={20}
                color="#E0E0E0"
              />
            </LinearGradient>
          </TouchableOpacity>
        }
        contentStyle={[
          styles.menuContent,
          {
            backgroundColor: '#0a0a0a',
          },
        ]}
      >
        <ScrollView style={styles.menuScroll} nestedScrollEnabled>
          {supportedLanguages.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              onPress={() => handleLanguageSelect(lang)}
              activeOpacity={0.8}
              style={styles.menuItemContainer}
            >
              {language.code === lang.code ? (
                <LinearGradient
                  colors={['#4c63d2', '#667eea', '#5a6fd8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.menuItem}
                >
                  <Text style={[styles.menuFlag, { fontSize: 24 }]}>{lang.flag}</Text>
                  <Text
                    style={[
                      styles.menuItemText,
                      {
                        color: '#FFFFFF',
                        fontWeight: '600',
                      },
                    ]}
                  >
                    {lang.name}
                  </Text>
                  <MaterialCommunityIcons
                    name="check"
                    size={20}
                    color="#FFFFFF"
                  />
                </LinearGradient>
              ) : (
                <LinearGradient
                  colors={['#151515', '#1a1a1a', '#151515']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.menuItem}
                >
                  <Text style={[styles.menuFlag, { fontSize: 24 }]}>{lang.flag}</Text>
                  <Text
                    style={[
                      styles.menuItemText,
                      {
                        color: '#B0B0B0',
                        fontWeight: '400',
                      },
                    ]}
                  >
                    {lang.name}
                  </Text>
                </LinearGradient>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Menu>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  selectorButtonContainer: {
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.3)',
    } : {
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 5,
    }),
  },
  selectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  flag: {
    marginRight: 12,
  },
  languageName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  menuContent: {
    maxHeight: 400,
    borderRadius: 12,
    paddingVertical: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1a1a1a',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.5)',
    } : {
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.5,
      shadowRadius: 8,
      elevation: 10,
    }),
  },
  menuScroll: {
    maxHeight: 400,
  },
  menuItemContainer: {
    borderRadius: 8,
    marginHorizontal: 4,
    marginVertical: 2,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
  },
  menuFlag: {
    marginRight: 12,
    width: 32,
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
  },
});

