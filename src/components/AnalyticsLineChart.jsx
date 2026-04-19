import { useMemo, useState } from 'react';

function buildLinePath(points) {
  if (!points.length) {
    return '';
  }

  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');
}

function buildAreaPath(points, baseline) {
  if (!points.length) {
    return '';
  }

  const line = buildLinePath(points);
  const endPoint = points[points.length - 1];
  const startPoint = points[0];
  return `${line} L ${endPoint.x.toFixed(2)} ${baseline.toFixed(2)} L ${startPoint.x.toFixed(2)} ${baseline.toFixed(2)} Z`;
}

export function AnalyticsLineChart({ data, primaryKey = 'scans', secondaryKey = 'flagged', className = '' }) {
  const [hoveredIndex, setHoveredIndex] = useState(data.length - 1);

  const { primaryPoints, secondaryPoints, gridLines, maxValue, viewBox } = useMemo(() => {
    const width = 640;
    const height = 250;
    const paddingX = 18;
    const paddingTop = 18;
    const paddingBottom = 36;
    const graphWidth = width - paddingX * 2;
    const graphHeight = height - paddingTop - paddingBottom;
    const chartMax = Math.max(
      1,
      ...data.flatMap((item) => [item[primaryKey] ?? 0, item[secondaryKey] ?? 0]),
    );

    const pointBuilder = (key) =>
      data.map((item, index) => ({
        x: paddingX + (graphWidth / Math.max(data.length - 1, 1)) * index,
        y: paddingTop + graphHeight - ((item[key] ?? 0) / chartMax) * graphHeight,
        value: item[key] ?? 0,
        label: item.label,
      }));

    return {
      primaryPoints: pointBuilder(primaryKey),
      secondaryPoints: pointBuilder(secondaryKey),
      gridLines: Array.from({ length: 4 }, (_, index) => {
        const ratio = index / 3;
        return paddingTop + graphHeight * ratio;
      }),
      maxValue: chartMax,
      viewBox: { width, height, paddingTop, paddingBottom },
    };
  }, [data, primaryKey, secondaryKey]);

  const safeIndex = hoveredIndex >= 0 ? hoveredIndex : data.length - 1;
  const activePrimaryPoint = primaryPoints[safeIndex] ?? primaryPoints[primaryPoints.length - 1];
  const activeSecondaryPoint = secondaryPoints[safeIndex] ?? secondaryPoints[secondaryPoints.length - 1];
  const activeDatum = data[safeIndex] ?? data[data.length - 1];

  if (!data.length) {
    return <div className={`analytics-line-chart analytics-line-chart-empty ${className}`.trim()} />;
  }

  return (
    <div className={`analytics-line-chart ${className}`.trim()}>
      <div className="analytics-line-chart__legend">
        <div className="chart-legend-item">
          <span className="chart-legend-swatch is-primary" />
          <div>
            <strong>{activeDatum?.[primaryKey] ?? 0}</strong>
            <span>Total scans</span>
          </div>
        </div>
        <div className="chart-legend-item">
          <span className="chart-legend-swatch is-danger" />
          <div>
            <strong>{activeDatum?.[secondaryKey] ?? 0}</strong>
            <span>Flagged activity</span>
          </div>
        </div>
        <div className="chart-tooltip-label">{activePrimaryPoint?.label}</div>
      </div>
      <svg
        className="analytics-line-chart__svg"
        viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="trendAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#00d1ff" stopOpacity="0.42" />
            <stop offset="100%" stopColor="#00d1ff" stopOpacity="0.02" />
          </linearGradient>
          <filter id="trendGlow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {gridLines.map((line, index) => (
          <line
            key={line}
            className="analytics-line-chart__grid-line"
            x1="18"
            y1={line}
            x2={viewBox.width - 18}
            y2={line}
          />
        ))}
        <path
          className="analytics-line-chart__area"
          d={buildAreaPath(primaryPoints, viewBox.height - viewBox.paddingBottom)}
        />
        <path
          className="analytics-line-chart__line is-primary"
          d={buildLinePath(primaryPoints)}
          filter="url(#trendGlow)"
        />
        <path
          className="analytics-line-chart__line is-secondary"
          d={buildLinePath(secondaryPoints)}
        />
        {primaryPoints.map((point, index) => (
          <g key={point.label} onMouseEnter={() => setHoveredIndex(index)}>
            <rect
              className="analytics-line-chart__hitbox"
              x={point.x - 12}
              y={viewBox.paddingTop - 8}
              width="24"
              height={viewBox.height - viewBox.paddingTop - 10}
              rx="12"
            />
            {safeIndex === index ? (
              <>
                <line
                  className="analytics-line-chart__focus-line"
                  x1={point.x}
                  y1={viewBox.paddingTop}
                  x2={point.x}
                  y2={viewBox.height - viewBox.paddingBottom}
                />
                <circle className="analytics-line-chart__point is-primary" cx={point.x} cy={point.y} r="6" />
                <circle
                  className="analytics-line-chart__point is-secondary"
                  cx={activeSecondaryPoint.x}
                  cy={activeSecondaryPoint.y}
                  r="5"
                />
              </>
            ) : null}
          </g>
        ))}
        {data.map((item, index) => (
          <text
            key={`${item.label}-tick`}
            className="analytics-line-chart__tick"
            x={primaryPoints[index].x}
            y={viewBox.height - 10}
            textAnchor="middle"
          >
            {item.label}
          </text>
        ))}
        <text className="analytics-line-chart__cap" x={16} y={12}>
          {maxValue}
        </text>
      </svg>
    </div>
  );
}
