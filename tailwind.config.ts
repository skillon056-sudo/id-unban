import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Light theme inspired by ff.garena.com — white surfaces, yellow accent.
        bg: "#ffffff",
        surface: "#f6f7f9",
        card: "#ffffff",
        border: "#e5e7eb",
        accent: "#ffba00",
        accent2: "#eba700",
        muted: "#6b7280",
        ink: "#111827",
      },
      fontFamily: {
        sans: ["'Titillium Web'", "system-ui", "sans-serif"],
        display: ["'Titillium Web'", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 8px 20px -6px rgba(255,186,0,0.45)",
        card: "0 6px 24px -14px rgba(16,24,40,0.18)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "0.25" },
          "50%": { opacity: "0.5" },
        },
        tick: {
          "0%": { opacity: "0.35", transform: "translateY(-3px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-through": {
          "0%": { opacity: "0", transform: "translateX(26px)" },
          "18%": { opacity: "1", transform: "translateX(0)" },
          "78%": { opacity: "1", transform: "translateX(0)" },
          "100%": { opacity: "0", transform: "translateX(-26px)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.4s ease-out",
        "slide-through": "slide-through 800ms ease-in-out both",
        "pulse-soft": "pulse-soft 2.4s ease-in-out infinite",
        tick: "tick 260ms ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
