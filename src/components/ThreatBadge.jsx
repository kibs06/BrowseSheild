export function ThreatBadge({ tone = 'low', children }) {
  return <span className={`threat-badge tone-${tone}`}>{children}</span>;
}
