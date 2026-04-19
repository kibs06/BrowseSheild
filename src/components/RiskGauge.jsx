export function RiskGauge({ value = 0, label = 'Low', tone = 'safe' }) {
  const degrees = Math.max(0, Math.min(100, value)) * 3.6;

  return (
    <div className={`risk-gauge tone-${tone}`}>
      <div
        className="risk-gauge-ring"
        style={{
          background: `conic-gradient(var(--gauge-color) 0deg ${degrees}deg, rgba(148, 163, 184, 0.14) ${degrees}deg 360deg)`,
        }}
      >
        <div className="risk-gauge-core">
          <span className="gauge-value">{value}</span>
          <span className="gauge-label">{label}</span>
        </div>
      </div>
    </div>
  );
}
