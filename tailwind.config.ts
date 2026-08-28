import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "var(--color-ink-900)",
          900: "var(--color-ink-900)",
          800: "var(--color-ink-800)",
          700: "var(--color-ink-700)",
          600: "var(--color-ink-600)",
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
          DEFAULT: "var(--color-mist)",
          light: "var(--color-mist-light)",
        },
      },
      fontFamily: {
        display: ["var(--font-poppins)", "sans-serif"],
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
        logoPulse: {
          "0%,100%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.08)", opacity: "0.75" },
        },
      },
      animation: {
        pulseRing: "pulseRing 2.2s cubic-bezier(0.4,0,0.6,1) infinite",
        floatSlow: "floatSlow 6s ease-in-out infinite",
        fadeUp: "fadeUp 0.4s ease-out both",
        logoPulse: "logoPulse 1.1s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
