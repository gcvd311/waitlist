import type { Config } from "tailwindcss";

// Colours are CSS variables so a cream "surface" can flip them: on the red ground
// bone is cream text, inside a cream card bone is deep cherry. Same classes, both contexts.
const v = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: v("ink"),
        wine: v("wine"),
        claret: v("claret"),
        bone: v("bone"),
        paper: v("paper"),
        dust: v("dust"),
        acid: v("acid"),
        rouge: v("rouge"),
        sage: v("sage"),
        gold: v("gold"),
        field: v("field"),
      },
      fontFamily: {
        serif: ['"Playfair Display"', "Georgia", "serif"],
        sans: ['"Inter Tight"', "system-ui", "sans-serif"],
        mono: ['"Oswald"', '"Arial Narrow"', "sans-serif"],
      },
      letterSpacing: { label: "0.08em" },
    },
  },
  plugins: [],
} satisfies Config;
