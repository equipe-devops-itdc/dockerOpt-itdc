// Recharts et le SVG brut n'acceptent pas les classes Tailwind — ce petit
// utilitaire centralise donc la couleur d'accent en valeur littérale, pour
// les quelques endroits qui ne peuvent pas passer par `signal-accent`.
// Reste synchronisé avec --accent dans index.css (cyan électrique en
// sombre, vert émeraude en clair) : à modifier aux DEUX endroits si la
// teinte change un jour.
export function getAccentHex(theme) {
  return theme === 'light' ? '#059669' : '#2DD4BF'
}
