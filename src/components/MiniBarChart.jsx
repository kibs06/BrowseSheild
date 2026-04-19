export function MiniBarChart({ items }) {
  const maxValue = Math.max(...items.map((item) => item.value));

  return (
    <div className="mini-bar-chart">
      {items.map((item) => (
        <div key={item.label} className="mini-bar-item">
          <div className="mini-bar-top">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
          <div className="mini-bar-track">
            <div
              className={`mini-bar-fill tone-${item.tone}`}
              style={{ width: `${(item.value / maxValue) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
