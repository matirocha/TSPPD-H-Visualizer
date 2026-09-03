/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        // paleta de datos accesible (WCAG AA)
        alpha: { DEFAULT: "#DC2626", fg: "#FFFFFF", light: "#FEF2F2", border: "#FECACA" },
        beta: { DEFAULT: "#0E7490", fg: "#FFFFFF", light: "#ECFEFF", border: "#A5F3FC" },
        handling: { DEFAULT: "#B45309", fg: "#FFFFFF", light: "#FFFBEB", border: "#FDE68A" },
        success: { DEFAULT: "#047857", fg: "#FFFFFF", light: "#ECFDF5", border: "#6EE7B7" },
        ink: { DEFAULT: "#0F172A", light: "#F8FAFC", muted: "#475569", line: "#E2E8F0" },
      },
      borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)" },
      fontFamily: {
        sans: ["Geist", "Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Geist Mono", "monospace"],
        display: ["Space Grotesk", "Geist", "sans-serif"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      }
    },
  },
  plugins: [],
}
