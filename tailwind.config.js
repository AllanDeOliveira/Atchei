/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#FFFCF8",
        surface: "#FFFFFF",
        surfaceHover: "#FFF6E9",
        primary: "#FFB34D",
        primaryHover: "#F5A233",
        accent: "#A66300",
        accentHover: "#8A5200",
        textLight: "#000000",
        textMuted: "#78716C",
        textDark: "#000000",
        glass: "rgba(255, 255, 255, 0.65)",
        glassBorder: "rgba(0, 0, 0, 0.08)",
        danger: "#EF4444",
        success: "#10B981",
        warning: "#B45309",
      },
      // ─── PONTO ÚNICO DE TROCA DE FONTE ───
      // Família unificada Plus Jakarta Sans para títulos e corpo (hierarquia via peso).
      // 'display'/'mono' são aliases da mesma família, para os usos legados renderizarem
      // sem serifa nem monoespaçado. Para alinhar números, usar `tabular-nums`.
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'sans-serif'],
        mono: ['Plus Jakarta Sans', 'sans-serif'],
      },
      boxShadow: {
        'glow-primary': '0 4px 20px rgba(255, 179, 77, 0.25)',
        'glow-success': '0 4px 20px rgba(16, 185, 129, 0.15)',
        'glass-shadow': '0 12px 40px -10px rgba(0, 0, 0, 0.06)',
        'glow-success-lg': '0 8px 30px rgba(16, 185, 129, 0.28)',
        'float': '0 20px 50px rgba(0, 0, 0, 0.08)',
      },
    },
  },
  plugins: [],
}
