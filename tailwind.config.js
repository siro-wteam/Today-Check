/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./hooks/**/*.{js,jsx,ts,tsx}",
    "./constants/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Modern Minimalist Color System - v0 디자인 색상 적용
        primary: '#0080F0',
        'primary-dark': '#0066C0',
        background: '#F9FAFB',
        card: '#FFFFFF',
        'text-main': '#222B38',
        'text-sub': '#9CA3AF',
        'text-disabled': '#D1D5DB',
        error: '#EF4444',
        warning: '#F59E0B',
        success: '#00A855',
        border: '#E5E7EB',
        'border-light': '#F3F4F6',
      },
      borderRadius: {
        'sm': '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '20px',
      },
      spacing: {
        'xs': '4px',
        'sm': '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '20px',
        'xxl': '24px',
      },
    },
  },
  plugins: [],
}

