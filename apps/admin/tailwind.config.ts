import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          background: '#0a0e1a',
          surface: '#111827',
          'surface-hover': '#1f2937',
          border: '#1f2937',
          primary: '#6366f1',
          'primary-hover': '#818cf8',
          text: '#f9fafb',
          'text-secondary': '#9ca3af',
          'text-muted': '#6b7280',
          accent: '#8b5cf6',
          success: '#22c55e',
          warning: '#f59e0b',
          error: '#ef4444',
        },
      },
    },
  },
  plugins: [],
}

export default config
