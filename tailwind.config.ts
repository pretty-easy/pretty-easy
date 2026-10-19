import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ground: "#FBF7F4",
        cream: "#FBF7F4",
        ink: "#2B1A28",
        muted: "#8A7386",
        line: "#F0E2DF",
        blush: {
          50: "#FBF2F1",
          100: "#F6E3E1",
          200: "#EED9D6",
          300: "#E3B5B1",
          400: "#D98E8A",
          500: "#D98E8A",
          600: "#B85D57",
        },
        plum: {
          500: "#6B4260",
          700: "#4A2B45",
          900: "#3A2136",
        },
        success: { DEFAULT: "#2E7D5B", 50: "#E6F4EC" },
        warn: { DEFAULT: "#B7791F", 50: "#FFF4DD" },
        danger: { DEFAULT: "#B3261E", 50: "#FDECEA" },
      },
      fontFamily: {
        heebo: ["Heebo", "sans-serif"],
      },
      borderRadius: {
        "2xl": "1.25rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
      boxShadow: {
        soft: "0 8px 24px rgba(74,43,69,0.06)",
        card: "0 10px 28px rgba(74,43,69,0.10)",
        plum: "0 10px 24px rgba(74,43,69,0.30)",
        blush: "0 14px 30px rgba(217,142,138,0.45)",
        up: "0 -12px 30px rgba(74,43,69,0.06)",
      },
    },
  },
  plugins: [],
};
export default config;
