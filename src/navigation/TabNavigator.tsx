// src/navigation/TabNavigator.tsx
import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Sparkles, ShoppingBag, Sliders } from 'lucide-react-native';
import { TryOnScreen } from '../screens/TryOnScreen';
import { CatalogScreen } from '../screens/CatalogScreen';
import { AdminScreen } from '../screens/AdminScreen';
import { colors, borderRadius } from '../theme';
import { useI18n } from '../i18n';

const Tab = createBottomTabNavigator();

export function TabNavigator() {
  const { t } = useI18n();

  return (
    <Tab.Navigator
      id="main-tab-navigator"
      initialRouteName="TryOn"
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 84 : 64,
          paddingTop: 6,
          paddingBottom: Platform.OS === 'ios' ? 22 : 8,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 0.8,
          marginTop: 2,
        },
      }}
    >
      <Tab.Screen
        name="TryOn"
        component={TryOnScreen}
        options={{
          title: t('tryOnTab'),
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrapper, focused && styles.iconWrapperActive]}>
              <Sparkles size={17} color={color} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Catalog"
        component={CatalogScreen}
        options={{
          title: t('catalogTab'),
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrapper, focused && styles.iconWrapperActive]}>
              <ShoppingBag size={17} color={color} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Admin"
        component={AdminScreen}
        options={{
          title: t('adminTab'),
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrapper, focused && styles.iconWrapperActive]}>
              <Sliders size={17} color={color} />
            </View>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  iconWrapper: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
  },
  iconWrapperActive: {
    backgroundColor: colors.surfaceLight,
  },
});
