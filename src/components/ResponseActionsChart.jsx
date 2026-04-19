function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

function polarToCartesian(cx, cy, r, angleInDegrees) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: cx + r * Math.cos(angleInRadians),
    y: cy + r * Math.sin(angleInRadians),
  };
}

export function ResponseActionsChart({ items }) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  let runningAngle = 0;

  return (
    <div className="response-actions-chart">
      <div className="response-actions-chart__ring">
        <svg viewBox="0 0 220 220" className="response-actions-chart__svg" aria-hidden="true">
          <circle className="response-actions-chart__track" cx="110" cy="110" r="78" />
          {items.map((item) => {
            const angle = total ? (item.value / total) * 360 : 0;
            const startAngle = runningAngle;
            runningAngle += angle;

            return (
              <path
                key={item.key}
                d={describeArc(110, 110, 78, startAngle, runningAngle)}
                className="response-actions-chart__segment"
                style={{ stroke: item.accent }}
              />
            );
          })}
        </svg>
        <div className="response-actions-chart__center">
          <strong>{total}</strong>
          <span>Total responses</span>
        </div>
      </div>
      <div className="response-actions-chart__legend">
        {items.map((item) => (
          <div key={item.key} className="response-actions-chart__legend-row">
            <span className="response-actions-chart__swatch" style={{ background: item.accent }} />
            <div className="response-actions-chart__legend-copy">
              <strong>{item.label}</strong>
              <span>{item.percentage}% of actions</span>
            </div>
            <div className="response-actions-chart__legend-value">{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
