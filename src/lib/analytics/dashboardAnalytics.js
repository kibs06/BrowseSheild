export function buildScanTrend(scans) {
  const lastSevenDays = [...Array(7)].map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);
    const count = scans.filter((scan) => scan.scannedAt.slice(0, 10) === key).length;
    return {
      label: key.slice(5),
      value: count,
    };
  });

  return lastSevenDays;
}

export function buildActionBreakdown(actions) {
  const counts = new Map();
  actions.forEach((action) => {
    counts.set(action.actionType, (counts.get(action.actionType) ?? 0) + 1);
  });

  return [...counts.entries()].map(([label, value]) => ({
    label,
    value,
    tone: label === 'trusted_site' ? 'safe' : label === 'continued_anyway' ? 'warning' : 'primary',
  }));
}

export function buildTopDomains(scans) {
  const counts = new Map();
  scans
    .filter((scan) => ['High', 'Critical'].includes(scan.riskLevel))
    .forEach((scan) => {
      counts.set(scan.hostname, (counts.get(scan.hostname) ?? 0) + 1);
    });

  return [...counts.entries()]
    .map(([label, value]) => ({ label, value, tone: 'danger' }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
}
