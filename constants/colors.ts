/**
 * Modern Minimalist Color System (Linear Style)
 * Consistent color palette for the entire app
 */

export const colors = {
  // Primary - v0 디자인 색상 적용
  primary: '#0080F0', // v0 디자인 Primary 색상
  primaryDark: '#0066C0', // Darker blue for active states
  primaryForeground: '#FFFFFF', // White text on primary background
  
  // Backgrounds
  background: '#FAFAFA', // Off White - Main BG
  card: '#FFFFFF', // Pure White - Card/Item BG
  
  // Text - v0 디자인 색상 적용
  textMain: '#222B38', // v0 디자인 Text Main 색상
  textSub: '#6B7280', // Cool Gray - Secondary text
  textDisabled: '#D1D5DB', // Very light gray - Disabled
  
  // Status Colors - v0 디자인 색상 적용
  error: '#EF4444', // Soft Red - Overdue/Error
  warning: '#F59E0B', // Orange - Late completion
  success: '#00A855', // v0 디자인 Success 색상
  
  // Neutral Shades
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',
  
  // Borders
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  
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
