import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        // Design tokens: Navy background, violet accent, green for good, red for bad
        navy: {
          950: '#050814',
          900: '#070c1e',
          800: '#0c1533',
          700: '#14214d',
          600: '#1c2e6b',
        },
        violet: {
          DEFAULT: '#8b5cf6',
          glow: '#a78bfa',
          deep: '#6d28d9',
        },
        good: {
          DEFAULT: '#22c55e',
          glow: '#4ade80',
          dark: '#15803d',
        },
        bad: {
          DEFAULT: '#ef4444',
          glow: '#f87171',
          dark: '#b91c1c',
        },
        background: '#070c1e', // Dark navy background
        foreground: '#f1f5f9',
        card: {
          DEFAULT: 'rgba(12, 21, 51, 0.75)',
          foreground: '#f1f5f9',
        },
        popover: {
          DEFAULT: '#0c1533',
          foreground: '#f1f5f9',
        },
        primary: {
          DEFAULT: '#8b5cf6', // Violet accent
          foreground: '#ffffff',
        },
        secondary: {
          DEFAULT: '#14214d',
          foreground: '#f1f5f9',
        },
        muted: {
          DEFAULT: '#101a3b',
          foreground: '#94a3b8',
        },
        accent: {
          DEFAULT: '#8b5cf6', // Violet
          foreground: '#ffffff',
        },
        destructive: {
          DEFAULT: '#ef4444', // Red for bad
          foreground: '#ffffff',
        },
        success: {
          DEFAULT: '#22c55e', // Green for good
          foreground: '#ffffff',
        },
        border: 'rgba(255, 255, 255, 0.08)',
        input: 'rgba(255, 255, 255, 0.1)',
        ring: '#8b5cf6',
      },
      borderRadius: {
        lg: '0.75rem',
        md: 'calc(0.75rem - 2px)',
        sm: 'calc(0.75rem - 4px)',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '0.5', filter: 'blur(20px)' },
          '50%': { opacity: '0.8', filter: 'blur(30px)' },
        },
        'radar-sweep': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        }
      },
      animation: {
        'pulse-glow': 'pulse-glow 4s ease-in-out infinite',
        'radar': 'radar-sweep 8s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
