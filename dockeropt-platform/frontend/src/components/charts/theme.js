// Recharts exige des couleurs littérales (pas de classes Tailwind), donc ce
// module fournit deux palettes explicites au lieu de constantes fixes — les
// composants graphiques appellent getChartTheme(theme) avec le thème actif
// (voir useTheme()) pour rester cohérents avec le reste de l'interface.
// Les valeurs suivent la même échelle "slate" que index.css.
const DARK = {
  grid: '#1C2430',
  text: '#5B6472',
  tooltip: {
    contentStyle: {
      background: '#10151D',
      border: '1px solid #232B36',
      borderRadius: 10,
      fontSize: 12,
      fontFamily: '"JetBrains Mono", monospace',
      color: '#DCE4EC',
    },
    labelStyle: { color: '#8994A3', marginBottom: 4 },
    cursor: { fill: 'rgba(255,255,255,0.03)' },
  },
}

const LIGHT = {
  grid: '#E2E8F0',
  text: '#64748B',
  tooltip: {
    contentStyle: {
      background: '#FFFFFF',
      border: '1px solid #E2E8F0',
      borderRadius: 10,
      fontSize: 12,
      fontFamily: '"JetBrains Mono", monospace',
      color: '#0F172A',
      boxShadow: '0 4px 20px -6px rgba(15,23,42,0.12)',
    },
    labelStyle: { color: '#475569', marginBottom: 4 },
    cursor: { fill: 'rgba(15,23,42,0.04)' },
  },
}

export function getChartTheme(theme) {
  return theme === 'light' ? LIGHT : DARK
}
