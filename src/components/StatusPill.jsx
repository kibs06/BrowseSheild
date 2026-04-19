export function StatusPill({ state = 'safe', label }) {
  return (
    <div className={`status-pill tone-${state}`}>
      <span className="status-dot" />
      {label}
    </div>
  );
}
