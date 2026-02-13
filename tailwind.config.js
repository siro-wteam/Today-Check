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
        // v0 primary blue: oklch(0.55 0.2 250) ≈ #3b82f6 (blue-500)
        primary: '#3b82f6',
        'primary-dark': '#2563eb',
        'primary-foreground': '#ffffff',
        background: '#F8FAFC',    // oklch(0.98 0.005 250)
        foreground: '#1e293b',    // oklch(0.2 0.02 260)
        card: '#FFFFFF',
        'card-foreground': '#1e293b',
        'text-main': '#1e293b',
        'text-sub': '#64748b',    // muted-foreground
        'text-disabled': '#94a3b8',
        secondary: '#f1f5f9',     // oklch(0.96 0.01 250)
        muted: '#f1f5f9',         // oklch(0.95 0.01 250)
        'muted-foreground': '#64748b',
        error: '#dc2626',         // destructive
        warning: '#d97706',
        success: '#16a34a',
        border: '#e2e8f0',        // oklch(0.92 0.01 250)
        'border-light': '#f1f5f9',
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

