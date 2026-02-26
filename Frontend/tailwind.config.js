/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: '#0f172a', // A deep luxury blue for our Shortlet theme
        accent: '#38bdf8' // A nice pop of blue for buttons
      }
    },
  },
  plugins: [],
}