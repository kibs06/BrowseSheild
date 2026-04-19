import { InteractiveSurface } from './InteractiveSurface';

export function FilterChips({ filters, activeFilter, onChange }) {
  return (
    <div className="filter-chip-row">
      {filters.map((filter) => (
        <InteractiveSurface
          key={filter}
          as="button"
          type="button"
          preset="button"
          inlineContent
          className={`filter-chip${activeFilter === filter ? ' is-active' : ''}`}
          onClick={() => onChange(filter)}
        >
          {filter}
        </InteractiveSurface>
      ))}
    </div>
  );
}
