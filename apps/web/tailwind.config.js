/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#FBF3EA",
          100: "#F3E0CC",
          300: "#E39A62",
          600: "#C4621A",
          700: "#BF5700",
          800: "#8C3A0F",
          900: "#6B2C0C",
        },
        slate: {
          50: "#F7F1E6",
          100: "#EFE6D6",
          200: "#E4D7C3",
          300: "#D2C2A8",
          400: "#A89480",
          500: "#7D6E5D",
          600: "#5F5348",
          700: "#433C36",
          800: "#2A2420",
          900: "#1C1916",
        },
      },
    },
  },
  plugins: [],
};
