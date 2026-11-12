import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#16090B",
        wine: "#2E0E13",
        claret: "#4A141C",
        bone: "#EEE5D6",
        paper: "#F5F0E7",
        dust: "#A8988A",
        acid: "#D6DE5B",
        rouge: "#D8492E",
        sage: "#9EBBA6",
      },
      fontFamily: {
        serif: ['"Instrument Serif"', "Georgia", "serif"],
        sans: ['"Inter Tight"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      letterSpacing: { label: "0.18em" },
    },
  },
  plugins: [],
} satisfies Config;
