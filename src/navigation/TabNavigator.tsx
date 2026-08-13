// src/navigation/TabNavigator.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import { ProvadorScreen } from '../screens/ProvadorScreen';
import { CatalogScreen } from '../screens/CatalogScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ClothingItem, TabType } from '../types';
import { getStoredCatalog } from '../lib/storage';
import { Sparkles, ShoppingBag, Settings } from 'lucide-react-native';

export const TabNavigator: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('provador');
  const [isDark, setIsDark] = useState<boolean>(true);
  const [catalog, setCatalog] = useState<ClothingItem[]>([]);
  const [selectedGarment, setSelectedGarment] = useState<ClothingItem | null>(null);

  const loadCatalog = async () => {
    const items = await getStoredCatalog();
    setCatalog(items);
    if (items.length > 0 && !selectedGarment) {
      setSelectedGarment(items[0]);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  const bg = isDark ? '#0f172a' : '#f8fafc';
  const tabBarBg = isDark ? '#1e293b' : '#ffffff';
  const borderCol = isDark ? '#334155' : '#e2e8f0';
  const textColor = isDark ? '#f8fafc' : '#0f172a';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Main Screen View */}
      <View style={styles.contentContainer}>
        {activeTab === 'provador' && (
          <ProvadorScreen
            catalog={catalog}
            isDark={isDark}
            onNavigateToCatalog={() => setActiveTab('catalog')}
          />
        )}

        {activeTab === 'catalog' && (
          <CatalogScreen
            catalog={catalog}
            selectedItem={selectedGarment}
            onSelectGarment={(item) => setSelectedGarment(item)}
            onRefreshCatalog={loadCatalog}
            onGoToProvador={() => setActiveTab('provador')}
            isDark={isDark}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsScreen
            isDark={isDark}
            onToggleTheme={() => setIsDark(!isDark)}
          />
        )}
      </View>

      {/* React Native Bottom Tab Bar */}
      <View style={[styles.tabBar, { backgroundColor: tabBarBg, borderColor: borderCol }]}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setActiveTab('provador')}
          style={styles.tabItem}
        >
          <Sparkles color={activeTab === 'provador' ? '#3b82f6' : '#94a3b8'} size={20} />
          <Text
            style={[
              styles.tabLabel,
              { color: activeTab === 'provador' ? '#3b82f6' : '#94a3b8' },
            ]}
          >
            Provador
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setActiveTab('catalog')}
          style={styles.tabItem}
        >
          <ShoppingBag color={activeTab === 'catalog' ? '#3b82f6' : '#94a3b8'} size={20} />
          <Text
            style={[
              styles.tabLabel,
              { color: activeTab === 'catalog' ? '#3b82f6' : '#94a3b8' },
            ]}
          >
            Catálogo
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setActiveTab('settings')}
          style={styles.tabItem}
        >
          <Settings color={activeTab === 'settings' ? '#3b82f6' : '#94a3b8'} size={20} />
          <Text
            style={[
              styles.tabLabel,
              { color: activeTab === 'settings' ? '#3b82f6' : '#94a3b8' },
            ]}
          >
            Ajustes
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    height: 64,
    borderTopWidth: 1,
    alignItems: 'center',
    justifyContent: 'space-around',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '800',
    marginTop: 3,
  },
});
