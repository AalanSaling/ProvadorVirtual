// src/theme/theme.ts

export const colors = {
  // Deep Backgrounds (Luxury Noir)
  background: '#07080a',
  surface: '#0f1117',
  surfaceLight: '#171a23',
  surfaceLighter: '#202532',
  surfaceHighlight: '#293040',
  surfaceGlass: 'rgba(15, 17, 23, 0.92)',
  
  // Brand & Accents (Refined Champagne & Luxury Gold)
  primary: '#ffffff',
  primaryMuted: '#94a3b8',
  accent: '#d4af37', // Champagne Gold
  accentHover: '#e5c058',
  accentLight: '#f6df88',
  accentDark: '#8c7322',
  accentGlow: 'rgba(212, 175, 55, 0.12)',
  accentGlowStrong: 'rgba(212, 175, 55, 0.25)',

  // Semantic
  success: '#10b981',
  successLight: 'rgba(16, 185, 129, 0.12)',
  error: '#ef4444',
  errorLight: 'rgba(239, 68, 68, 0.12)',
  warning: '#f59e0b',
  warningLight: 'rgba(245, 158, 11, 0.12)',
  
  // Text
  textPrimary: '#ffffff',
  textSecondary: '#94a3b8',
  textTertiary: '#64748b',
  textInverse: '#07080a',
  textGold: '#d4af37',

  // Borders
  border: '#1c202b',
  borderLight: '#272d3e',
  borderHover: '#3b445d',
  borderActive: '#d4af37',
};

export const typography = {
  titleLarge: {
    fontSize: 24,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
    color: colors.textPrimary,
  },
  titleMedium: {
    fontSize: 18,
    fontWeight: '600' as const,
    letterSpacing: 0.3,
    color: colors.textPrimary,
  },
  titleSmall: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.textPrimary,
  },
  bodyLarge: {
    fontSize: 15,
    fontWeight: '400' as const,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  bodyMedium: {
    fontSize: 13,
    fontWeight: '400' as const,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  bodySmall: {
    fontSize: 11,
    fontWeight: '400' as const,
    color: colors.textTertiary,
  },
  caption: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
};

export const borderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  full: 9999,
};

export const shadows = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 4,
  },
  cardHover: {
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 6,
  },
  modal: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.7,
    shadowRadius: 28,
    elevation: 12,
  },
};

/**
 * Format currency gracefully according to standards:
 * BRL -> R$ 289,90
 * PYG -> ₲ 180.000
 * USD -> US$ 89.00
 * EUR -> € 79.00
 */
export function formatCurrency(price: number, currency: string = 'BRL'): string {
  const num = typeof price === 'number' && !isNaN(price) ? price : 0;
  switch (currency.toUpperCase()) {
    case 'BRL':
      return `R$ ${num.toFixed(2).replace('.', ',')}`;
    case 'PYG':
      return `₲ ${Math.round(num).toLocaleString('es-PY')}`;
    case 'USD':
      return `US$ ${num.toFixed(2)}`;
    case 'EUR':
      return `€ ${num.toFixed(2)}`;
    default:
      return `${currency} ${num.toFixed(2)}`;
  }
}

export const theme = {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  formatCurrency,
};

export default theme;
