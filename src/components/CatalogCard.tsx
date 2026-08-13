// src/components/CatalogCard.tsx
import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { ClothingItem } from '../types';
import { Sparkles, Check, Edit2, Trash2 } from 'lucide-react-native';

interface CatalogCardProps {
  item: ClothingItem;
  selected?: boolean;
  onSelect: () => void;
  onQuickTryOn?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
  isDark?: boolean;
}

export function formatPriceCurrency(price: number, currency: string = 'BRL'): string {
  const symbols: Record<string, string> = {
    BRL: 'R$',
    USD: '$',
    EUR: '€',
    PYG: '₲',
  };
  const sym = symbols[currency] || currency;
  const numStr = price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${sym} ${numStr}`;
}

export const CatalogCard: React.FC<CatalogCardProps> = ({
  item,
  selected = false,
  onSelect,
  onQuickTryOn,
  onEdit,
  onDelete,
  canEdit = false,
  canDelete = false,
  isDark = true,
}) => {
  const cardBg = selected
    ? isDark ? '#1e293b' : '#eff6ff'
    : isDark ? '#1e293b' : '#ffffff';

  const borderColor = selected
    ? '#3b82f6'
    : isDark ? '#334155' : '#e2e8f0';

  const textColor = isDark ? '#f8fafc' : '#0f172a';

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onSelect}
      style={[
        styles.cardContainer,
        { backgroundColor: cardBg, borderColor, borderWidth: selected ? 2 : 1 },
      ]}
    >
      <View style={styles.imageWrapper}>
        <Image source={{ uri: item.image }} style={styles.image} resizeMode="cover" />
        <View style={styles.badgeCategory}>
          <Text style={styles.badgeText}>{item.category.toUpperCase()}</Text>
        </View>
        {selected && (
          <View style={styles.selectedCheck}>
            <Check color="#ffffff" size={14} />
          </View>
        )}
      </View>

      <View style={styles.details}>
        <Text numberOfLines={1} style={[styles.title, { color: textColor }]}>
          {item.name}
        </Text>
        <Text style={styles.price}>{formatPriceCurrency(item.price, item.currency)}</Text>

        <View style={styles.actionRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onQuickTryOn || onSelect}
            style={[
              styles.tryOnButton,
              { backgroundColor: selected ? '#3b82f6' : isDark ? '#334155' : '#f1f5f9' },
            ]}
          >
            <Sparkles color={selected ? '#ffffff' : '#3b82f6'} size={12} />
            <Text
              style={[
                styles.tryOnButtonText,
                { color: selected ? '#ffffff' : isDark ? '#93c5fd' : '#2563eb' },
              ]}
            >
              {selected ? 'Selecionado' : 'Provar'}
            </Text>
          </TouchableOpacity>

          {(canEdit || canDelete) && (
            <View style={styles.adminBtns}>
              {canEdit && (
                <TouchableOpacity onPress={onEdit} style={[styles.iconBtn, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                  <Edit2 color="#3b82f6" size={12} />
                </TouchableOpacity>
              )}
              {canDelete && (
                <TouchableOpacity onPress={onDelete} style={[styles.iconBtn, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                  <Trash2 color="#ef4444" size={12} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  imageWrapper: {
    width: '100%',
    height: 170,
    position: 'relative',
    backgroundColor: '#0f172a',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  badgeCategory: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: {
    color: '#38bdf8',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  selectedCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#3b82f6',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  details: {
    padding: 10,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  price: {
    fontSize: 13,
    fontWeight: '800',
    color: '#3b82f6',
    marginBottom: 6,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tryOnButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 10,
    gap: 4,
  },
  tryOnButtonText: {
    fontSize: 10,
    fontWeight: '700',
  },
  adminBtns: {
    flexDirection: 'row',
    gap: 4,
  },
  iconBtn: {
    padding: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
