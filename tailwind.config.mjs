/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        chalk: {
          50: "#FCFCFA",
          100: "#F7F7F4",
          200: "#F0EFEB",
          300: "#E6E4DD",
          400: "#D3D0C5",
        },
        pitch: {
          DEFAULT: "#0A0A0A",
          subtle: "#121212",
          surface: "#181818",
          border: "#262626",
          muted: "#333333",
        },
        stone: {
          warm: "#ECEBE4",
          dim: "#8E8D88",
          dark: "#2A2A28",
        },
        enix: {
          red: "#DC2626",
          darkRed: "#991B1B",
          glow: "#EF4444",
          ink: "#0A0A0A",
          navy: "#111111",
          pearl: "#F7F7F4",
        },
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        display: ["Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ["JetBrains Mono", "SF Mono", "Menlo", "Consolas", "monospace"],
      },
      letterSpacing: {
        tighter: "-0.04em",
        tight: "-0.02em",
        editorial: "-0.03em",
        tracked: "0.18em",
      },
      boxShadow: {
        glow: "0 0 48px rgba(220, 38, 38, 0.26)",
        premium: "0 24px 80px rgba(15, 23, 42, 0.18)",
        subtle: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
        editorial: "0 20px 40px -15px rgba(0, 0, 0, 0.07)",
        "editorial-dark": "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
      },
    },
  },
  plugins: [],
};

