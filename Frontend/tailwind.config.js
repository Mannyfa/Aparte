export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
        display: ['"Syne"', 'sans-serif'], 
      },
      colors: {
        brand: '#0f172a', // The new deep obsidian blue
        accent: '#d4af37', // A warm gold/sand accent
      }
    },
  },
  plugins: [],
}