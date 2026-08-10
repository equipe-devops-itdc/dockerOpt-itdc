import { Search } from 'lucide-react'

export default function SearchInput({ value, onChange, placeholder = 'Rechercher…' }) {
  return (
    <div className="relative w-full sm:w-64">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-ink-800 border border-ink-500 rounded-lg pl-9 pr-3 py-2 text-sm text-text placeholder:text-text-faint focus:outline-none focus:border-signal-accent/50 transition-colors"
      />
    </div>
  )
}
