/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#ffffff",
          elevated: "#f8fafc",
          dark: "#111827",
          "dark-elevated": "#1f2937",
        },
        border: {
          DEFAULT: "#e5e7eb",
          dark: "#374151",
        },
        ink: {
          primary: "#111827",
          secondary: "#4b5563",
          muted: "#9ca3af",
          "dark-primary": "#f9fafb",
          "dark-secondary": "#d1d5db",
          "dark-muted": "#6b7280",
        },
        primary: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
        },
        kudos: {
          400: "#fb7185",
          500: "#f43f5e",
          600: "#e11d48",
        },
        accent: {
          50: "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c",
          800: "#9a3412",
          900: "#7c2d12",
        },
        activity: {
          rest: "#9ca3af",
          cross: "#818cf8",
          easy: "#34d399",
          pace: "#fbbf24",
          tempo: "#fb923c",
          long: "#f87171",
          intervals: "#a78bfa",
          race: "#ef4444",
        },
        map: {
          overlay: "rgba(17, 24, 39, 0.45)",
        },
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "SF Pro Text", "Helvetica Neue", "sans-serif"],
      },
      borderRadius: {
        card: "1rem",
        sheet: "1.5rem",
        pill: "9999px",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)",
        "card-dark": "0 1px 3px 0 rgb(0 0 0 / 0.35)",
        elevated: "0 4px 14px -2px rgb(0 0 0 / 0.08)",
      },
      spacing: {
        section: "1.25rem",
      },
    },
  },
  plugins: [],
};
