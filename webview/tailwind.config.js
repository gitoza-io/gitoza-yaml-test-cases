/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#6366f1",
          dark: "#818cf8",
        },
        panel: "#0b1220",
        ink: "#0a0a0a",
        muted: "#404040",
        "list-selected": "#e5e7eb",
        "list-hover": "#f3f4f6",
      },
      borderRadius: {
        ui: "6px",
        listItem: "0",
        card: "6px",
      },
    },
  },
  plugins: [],
};
