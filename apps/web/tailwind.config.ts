import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "#08090D",
          surface: "#0E1118",
          hover: "#161B26",
        },
        line: {
          subtle: "rgba(255,255,255,0.08)",
          glow: "rgba(0,242,254,0.3)",
        },
        cyan: { 400: "#00F2FE", 500: "#4FACFE" },
        yield: { 400: "#00E676", 500: "#1DE9B6", 600: "#00bfa5" },
        danger: { 400: "#FF9100", 500: "#FF5252" },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        "glow-cyan": "0px 0px 30px rgba(0,242,254,0.2)",
        "glow-emerald": "0px 0px 25px rgba(0,230,118,0.18)",
      },
      backdropBlur: {
        glass: "blur(16px) saturate(180%)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "pulse-glow": {
          "0%,100%": { boxShadow: "0 0 12px rgba(0,242,254,0.15)" },
          "50%": { boxShadow: "0 0 30px rgba(0,242,254,0.45)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.4s ease-out both",
        "pulse-glow": "pulse-glow 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;