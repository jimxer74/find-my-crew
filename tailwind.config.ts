// tailwind.config.ts
import type { Config } from 'tailwindcss'

export default {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    // add any other folders where your components live
  ],
  theme: {
    extend: {
      // your existing theme extensions
    },
  },
  plugins: [],
  // @ts-ignore — safelist is valid at runtime but missing from types
  safelist: [
    // ────────────────────────────────────────────────
    // Force Tailwind to keep these classes (prevents purge)
    // ────────────────────────────────────────────────
    'bg-red-500/80',
    'border-red-600',
    'text-red-800',

    'bg-orange-300/80',
    'border-orange-600',
    'text-orange-800',

    'bg-yellow-300/80',
    'border-yellow-600',
    'text-yellow-800',

    'bg-green-300/80',
    'border-green-500',
    'text-green-800',

    // Also include the light background variants (used in cards/tooltips)
    'bg-red-50',
    'border-red-200',

    'bg-orange-50',
    'border-orange-200',

    'bg-yellow-50',
    'border-yellow-200',

    'bg-green-50',
    'border-green-200',
  ] as const,
} satisfies Config