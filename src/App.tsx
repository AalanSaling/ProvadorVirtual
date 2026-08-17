// src/App.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nProvider } from './i18n';
import { CatalogProvider } from './context/CatalogContext';
import { TabNavigator } from './navigation/TabNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <CatalogProvider>
          <NavigationContainer>
            <TabNavigator />
          </NavigationContainer>
        </CatalogProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
