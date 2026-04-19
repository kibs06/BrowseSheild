export function TrendBars({ items }) {
  const maxValue = Math.max(1, ...items.map((item) => item.value));

  return (
    <div className="trend-bars">
      {items.map((item) => (
        <div key={item.label} className="trend-bar-item">
          <div
            className="trend-bar-fill"
            style={{ height: `${Math.max(16, (item.value / maxValue) * 100)}%` }}
          />
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}
