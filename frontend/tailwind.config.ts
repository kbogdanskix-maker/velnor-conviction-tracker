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
        // Vela brand palette
        vela: {
          teal: "#14b8a6",       // teal-500  - primary accent
          "teal-dim": "#0d9488", // teal-600  - hover state
          bg: "#030712",         // deep space blue-black
          card: "#0f1729",       // navy-tinted card background
          "card-hover": "#141d33", // slightly lighter on hover
          border: "#1e293b",     // slate-800  - cooler borders
          muted: "#64748b",      // slate-500  - muted text
          subtle: "#475569",     // slate-600  - very muted
        },
        // P&L colours
        gain: "#34d399",   // emerald-400
        loss: "#f43f5e",   // rose-500
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
        display: ["var(--font-space-grotesk)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0.5rem",
        sm: "0.375rem",
        lg: "0.75rem",
        xl: "1rem",
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
