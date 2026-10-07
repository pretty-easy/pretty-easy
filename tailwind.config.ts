import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        blush: {
          50: "#FBF2F1",
          100: "#F6E3E1",
          200: "#EEC9C6",
          300: "#E3A9A5",
          400: "#D98E8A",
          500: "#CE7670",
          600: "#B85D57",
        },
        plum: {
          500: "#6B4260",
          700: "#4A2B45",
          900: "#3A2136",
        },
        cream: "#FAF6F3",
      },
      fontFamily: {
        heebo: ["Heebo", "sans-serif"],
      },
      borderRadius: {
        "2xl": "1.25rem",
      },
    },
  },
  plugins: [],
};
export default config;
