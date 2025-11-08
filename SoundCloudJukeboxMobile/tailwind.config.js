/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Material Design 3 Dark Theme colors
        primary: '#667eea',
        'on-primary': '#FFFFFF',
        'primary-container': '#4c63d2',
        secondary: '#03DAC6',
        'on-secondary': '#000000',
        tertiary: '#BB86FC',
        error: '#CF6679',
        background: '#121212',
        'on-background': '#FFFFFF',
        surface: '#1E1E1E',
        'on-surface': '#FFFFFF',
        'surface-variant': '#2C2C2C',
        'on-surface-variant': '#B0B0B0',
        outline: '#3A3A3A',
      },
    },
  },
  plugins: [],
}

