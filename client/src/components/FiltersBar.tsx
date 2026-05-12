import type { Contact } from '../types/search'

interface FiltersBarProps {
  contacts: Contact[]
  senderId?: string
  hasLinkOnly: boolean
  dateFrom?: string
  dateTo?: string
  onSenderChange: (senderId?: string) => void
  onHasLinkChange: (hasLink: boolean) => void
  onDateFromChange: (value?: string) => void
  onDateToChange: (value?: string) => void
}

export function FiltersBar({
  contacts,
  senderId,
  hasLinkOnly,
  dateFrom,
  dateTo,
  onSenderChange,
  onHasLinkChange,
  onDateFromChange,
  onDateToChange,
}: FiltersBarProps) {
  return (
    <div className="filters-bar">
      <label className="filter-select">
        <span>Sender</span>
        <select
          value={senderId ?? ''}
          onChange={(event) => onSenderChange(event.target.value || undefined)}
        >
          <option value="">Anyone</option>
          {contacts.map((contact) => (
            <option key={contact.id} value={contact.id}>
              {contact.displayName}
            </option>
          ))}
        </select>
      </label>

      <label className="filter-select">
        <span>From</span>
        <input
          type="date"
          value={dateFrom ?? ''}
          onChange={(event) => onDateFromChange(event.target.value || undefined)}
        />
      </label>

      <label className="filter-select">
        <span>To</span>
        <input
          type="date"
          value={dateTo ?? ''}
          onChange={(event) => onDateToChange(event.target.value || undefined)}
        />
      </label>

      <label className={hasLinkOnly ? 'filter-toggle is-active' : 'filter-toggle'}>
        <input
          type="checkbox"
          checked={hasLinkOnly}
          onChange={(event) => onHasLinkChange(event.target.checked)}
        />
        <span>Links only</span>
      </label>
    </div>
  )
}
