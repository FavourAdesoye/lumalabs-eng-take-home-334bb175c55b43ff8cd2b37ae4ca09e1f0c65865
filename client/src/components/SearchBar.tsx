interface SearchBarProps {
  query: string
  placeholder: string
  onQueryChange: (query: string) => void
}

export function SearchBar({ query, placeholder, onQueryChange }: SearchBarProps) {
  return (
    <label className="search-bar">
      <span className="search-bar__icon" aria-hidden="true">
        S
      </span>
      <input
        type="search"
        value={query}
        placeholder={placeholder}
        onChange={(event) => onQueryChange(event.target.value)}
      />
    </label>
  )
}
