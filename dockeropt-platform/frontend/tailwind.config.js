/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Chaque teinte est pilotée par une variable CSS (voir index.css),
        // avec des valeurs différentes en mode sombre (par défaut) et en
        // mode clair (classe .light sur <html>). Le format "rgb(var(..) /
        // <alpha-value>)" préserve la compatibilité avec les utilitaires
        // d'opacité déjà utilisés partout dans l'app (ex: bg-ink-800/80).
        ink: {
          950: 'rgb(var(--ink-950) / <alpha-value>)',
          900: 'rgb(var(--ink-900) / <alpha-value>)',
          800: 'rgb(var(--ink-800) / <alpha-value>)',
          700: 'rgb(var(--ink-700) / <alpha-value>)',
          600: 'rgb(var(--ink-600) / <alpha-value>)',
          500: 'rgb(var(--ink-500) / <alpha-value>)',
          400: 'rgb(var(--ink-400) / <alpha-value>)',
        },
        text: {
          DEFAULT: 'rgb(var(--text) / <alpha-value>)',
          dim: 'rgb(var(--text-dim) / <alpha-value>)',
          faint: 'rgb(var(--text-faint) / <alpha-value>)',
        },
        signal: {
          // Couleur d'accent PRINCIPALE (marque, actions, statut positif) —
          // pilotée par --accent : cyan en sombre, orange en clair (voir
          // index.css). Les autres couleurs "signal" restent fixes dans les
          // deux thèmes car elles portent un sens précis (alerte, info…)
          // indépendant du thème.
          accent: 'rgb(var(--accent) / <alpha-value>)',
          blue: '#4C8DFF',
          violet: '#8B7CF6',
          amber: '#F5A524',
          red: '#FB5B4C',
        },
        // Texte des boutons à fond vif (accent/ambre) : toujours sombre,
        // dans les deux thèmes — contrairement à ink-950 qui change de sens
        // (surface la plus sombre en mode sombre, la plus claire en mode
        // clair) et ne convient donc pas ici.
        'accent-fg': '#0A0E14',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      animation: {
        'pulse-soft': 'pulseSoft 2.4s ease-in-out infinite',
      },
      keyframes: {
        pulseSoft: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.45 },
        },
      },
    },
  },
  plugins: [],
}
