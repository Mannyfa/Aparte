/** Apartey design tokens — warm paper, ink and a lime accent. */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'Inter', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        display: ['Geist', 'Inter', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        cream: '#F2F1EA',   // page background
        paper: '#FBFAF5',   // cards / alternate sections
        sand: '#E8E6DC',    // insets, hover fills
        line: '#DEDCD0',    // hairline borders
        ink: '#16160F',     // primary text
        muted: '#5A5949',   // secondary text
        faint: '#8C8A78',   // tertiary text
        night: '#181813',   // dark sections
        lime: { DEFAULT: '#D4F24A', soft: '#EEF9C2', deep: '#5A6B0F' },
        // legacy names kept so any leftover classes still match the new palette
        brand: '#16160F',
        accent: '#5A6B0F',
      },
      letterSpacing: { tightest: '-0.05em' },
      boxShadow: {
        soft: '0 1px 2px rgba(22,22,15,0.04), 0 8px 24px -12px rgba(22,22,15,0.12)',
        lift: '0 2px 4px rgba(22,22,15,0.04), 0 24px 48px -24px rgba(22,22,15,0.25)',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'none' } },
      },
      animation: { 'fade-up': 'fade-up .4s ease-out both', 'fade-in': 'fade-up .3s ease-out both' },
    },
  },
  plugins: [],
}
