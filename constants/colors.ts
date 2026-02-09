/**
 * Color System - v0 참고 소스(task-management-app) primary blue
 * V0와 동일한 진한 블루 (blue-600)
 */

export const colors = {
  // Primary - V0 진한 블루 (Tailwind blue-600)
  primary: '#2563eb',
  primaryDark: '#1d4ed8', // blue-700, active/pressed
  primaryForeground: '#FFFFFF', // primary-foreground
  
  // Backgrounds - 참고 소스 :root
  background: '#F8FAFC',   // oklch(0.98 0.005 250)
  card: '#FFFFFF',         // oklch(1 0 0)
  
  // Text - foreground: oklch(0.2 0.02 260), muted-foreground: oklch(0.5 0.02 260)
  textMain: '#1e293b',
  textSub: '#64748b',
  textDisabled: '#94a3b8',
  
  // Status - 참고 소스 destructive, success, warning
  error: '#dc2626',        // oklch(0.6 0.2 25)
  warning: '#d97706',      // oklch(0.75 0.15 65)
  success: '#16a34a',      // oklch(0.65 0.18 145)
  
  // Neutral / Secondary - secondary: oklch(0.96 0.01 250), muted: oklch(0.95 0.01 250)
  gray50: '#F8FAFC',
  gray100: '#F1F5F9',
  gray200: '#e2e8f0',      // border: oklch(0.92 0.01 250)
  gray300: '#cbd5e1',
  gray400: '#94a3b8',
  gray500: '#64748b',
  gray600: '#475569',
  gray700: '#334155',
  gray800: '#1e293b',
  gray900: '#0f172a',
  
  // Borders
  border: '#e2e8f0',       // oklch(0.92 0.01 250)
  borderLight: '#f1f5f9',
  
  // Overlays
  overlay: 'rgba(0, 0, 0, 0.05)',
  overlayDark: 'rgba(0, 0, 0, 0.1)',
} as const;

/**
 * Design Tokens
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
} as const;

export const shadows = {
  // Subtle shadow for cards
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  // Medium shadow for elevated elements
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  // Larger shadow for floating elements
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
} as const;

/**
 * Typography
 */
export const typography = {
  // Font Family - Geist
  fontFamily: {
    regular: 'Geist-Regular',
    medium: 'Geist-Medium',
    semibold: 'Geist-SemiBold',
    bold: 'Geist-Bold',
  },
  
  // Font Sizes
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  
  // Font Weights
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
} as const;
