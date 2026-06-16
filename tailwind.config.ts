import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // design tokens — โทนเดียวทั้งแอป
        bg: {
          0: "#0b0d10",
          1: "#131619",
          2: "#1a1d22",
          3: "#22262d",
        },
        line: "rgba(255,255,255,0.08)",
        brand: {
          DEFAULT: "#3b82f6",
          accent: "#ffb020",
        },
      },
      fontFamily: {
        sans: ["'IBM Plex Sans Thai'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      borderRadius: {
        card: "14px",
      },
    },
  },
  plugins: [],
};
export default config;
