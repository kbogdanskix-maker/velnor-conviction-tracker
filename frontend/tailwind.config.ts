import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Velnor brand palette — Instrument design system
        vela: {
          teal: "#14b8a6",        // primary accent — the ONLY brand accent
          "teal-dim": "#0d9488",  // hover state
          bg: "#050A16",          // page background
          card: "#0B1322",        // solid card surface
          "card-hover": "#111A2E",// raised surface
          border: "#1B2638",      // hairline border
          muted: "#8A97AC",       // muted text
          subtle: "#5A6678",      // faint text
        },
        // P&L — semantic only, never decoration
        gain: "#34d399",   // emerald-400
        loss: "#f43f5e",   // rose-500
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "4px",  // buttons, inputs
        sm: "4px",
        md: "6px",       // cards
        lg: "6px",
        xl: "8px",       // was 16px — caps oversized cards
        "2xl": "10px",   // was 16px — caps oversized cards
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "0.8" },
        },
        twinkle: {
          "0%, 100%": { opacity: "0.2", transform: "scale(0.8)" },
          "50%": { opacity: "1", transform: "scale(1.2)" },
        },
        drift: {
          "0%": { transform: "translate(0, 0)" },
          "50%": { transform: "translate(10px, -5px)" },
          "100%": { transform: "translate(0, 0)" },
        },
        "ambient-pulse": {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "1" },
        },
        "orbit": {
          "0%": { transform: "rotate(0deg) translateX(var(--orbit-radius, 60px)) rotate(0deg)" },
          "100%": { transform: "rotate(360deg) translateX(var(--orbit-radius, 60px)) rotate(-360deg)" },
        },
        // Nav icon micro-animations
        "icon-blink": {
          "0%, 30%, 50%, 100%": { transform: "scaleY(1)" },
          "40%": { transform: "scaleY(0.1)" },
        },
        "icon-wiggle": {
          "0%, 100%": { transform: "rotate(0deg)" },
          "20%": { transform: "rotate(-12deg)" },
          "40%": { transform: "rotate(10deg)" },
          "60%": { transform: "rotate(-6deg)" },
          "80%": { transform: "rotate(4deg)" },
        },
        "icon-bounce": {
          "0%, 100%": { transform: "translateY(0)" },
          "40%": { transform: "translateY(-3px)" },
          "60%": { transform: "translateY(-1px)" },
        },
        "icon-pulse": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.2)" },
        },
        "icon-spin": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "icon-ring": {
          "0%": { transform: "rotate(0deg)" },
          "10%": { transform: "rotate(14deg)" },
          "20%": { transform: "rotate(-12deg)" },
          "30%": { transform: "rotate(10deg)" },
          "40%": { transform: "rotate(-8deg)" },
          "50%, 100%": { transform: "rotate(0deg)" },
        },
      },
      animation: {
        shimmer: "shimmer 1.5s infinite linear",
        "fade-in-up": "fade-in-up 0.5s ease-out both",
        "glow-pulse": "glow-pulse 3s ease-in-out infinite",
        twinkle: "twinkle 4s ease-in-out infinite",
        drift: "drift 20s ease-in-out infinite",
        orbit: "orbit var(--orbit-duration, 30s) linear infinite",
        "icon-blink": "icon-blink 0.6s ease-in-out",
        "icon-wiggle": "icon-wiggle 0.5s ease-in-out",
        "icon-bounce": "icon-bounce 0.4s ease-out",
        "icon-pulse": "icon-pulse 0.4s ease-in-out",
        "icon-spin": "icon-spin 0.6s ease-in-out",
        "icon-ring": "icon-ring 0.6s ease-in-out",
      },
      backdropBlur: {
        xs: "2px",
      },
      boxShadow: {
        glow: "0 0 20px rgba(20, 184, 166, 0.15)",
        "glow-lg": "0 0 40px rgba(20, 184, 166, 0.2)",
        "inner-glow": "inset 0 1px 0 rgba(255, 255, 255, 0.05)",
      },
    },
  },
  plugins: [],
};

export default config;
