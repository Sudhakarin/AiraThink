import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#0A0C12",
          900: "#0A0C12",
          800: "#10131C",
          700: "#161A26",
          600: "#1E2333",
        },
        violet: {
          DEFAULT: "#7C5CFF",
          light: "#9C82FF",
          dark: "#5A3FE0",
        },
        teal: {
          DEFAULT: "#22D3B8",
        },
        mist: {
          DEFAULT: "#8B8FA3",
          light: "#C7C9D9",
        },
      },
      fontFamily: {
        display: ["var(--font-sora)", "sans-serif"],
        body: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-jbmono)", "monospace"],
      },
      backgroundImage: {
        "aurora": "radial-gradient(circle at 20% 20%, rgba(124,92,255,0.25), transparent 40%), radial-gradient(circle at 80% 0%, rgba(34,211,184,0.18), transparent 35%), radial-gradient(circle at 50% 100%, rgba(124,92,255,0.15), transparent 45%)",
      },
      keyframes: {
        pulseRing: {
          "0%": { transform: "scale(0.9)", opacity: "0.8" },
          "70%": { transform: "scale(1.6)", opacity: "0" },
          "100%": { transform: "scale(1.6)", opacity: "0" },
        },
        floatSlow: {
          "0%,100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        pulseRing: "pulseRing 2.2s cubic-bezier(0.4,0,0.6,1) infinite",
        floatSlow: "floatSlow 6s ease-in-out infinite",
        fadeUp: "fadeUp 0.4s ease-out both",
      },
    },
  },
  plugins: [],
};
export default config;
