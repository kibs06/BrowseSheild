import { InteractiveSurface } from './InteractiveSurface';

export function TimeRangeSelector({ options, value, onChange, className = '' }) {
  return (
    <div className={`time-range-selector ${className}`.trim()}>
      {options.map((option) => (
        <InteractiveSurface
          key={option.key}
          as="button"
          type="button"
          className={`time-range-chip${value === option.key ? ' is-active' : ''}`}
          preset="button"
          inlineContent
          onClick={() => onChange(option.key)}
        >
          {option.label}
        </InteractiveSurface>
      ))}
    </div>
  );
}
