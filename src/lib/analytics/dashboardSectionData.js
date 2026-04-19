const RANGE_CONFIG = {
  '24h': {
    key: '24h',
    label: '24H',
    bucketCount: 24,
    unit: 'hour',
    formatter: new Intl.DateTimeFormat('en-US', { hour: 'numeric' }),
  },
  '7d': {
    key: '7d',
    label: '7D',
    bucketCount: 7,
    unit: 'day',
    formatter: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }),
  },
  '30d': {
    key: '30d',
    label: '30D',
    bucketCount: 30,
    unit: 'day',
    formatter: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }),
  },
};

export const ANALYTICS_RANGE_OPTIONS = Object.values(RANGE_CONFIG).map(({ key, label }) => ({
  key,
  label,
}));

const ACTION_DISPLAY = {
  warned: { label: 'Warned', tone: 'primary', accent: '#00d1ff' },
  viewed_report: { label: 'Viewed Report', tone: 'primary', accent: '#3b82f6' },
  trusted_site: { label: 'Trusted Site', tone: 'safe', accent: '#22c55e' },
  left_site: { label: 'Left Site', tone: 'safe', accent: '#14b8a6' },
  continued_anyway: { label: 'Continued Anyway', tone: 'warning', accent: '#f59e0b' },
  false_positive: { label: 'False Positive', tone: 'warning', accent: '#94a3b8' },
};

function normalizeDate(value) {
  return value ? new Date(value) : null;
}

function getRangeConfig(rangeKey) {
  return RANGE_CONFIG[rangeKey] ?? RANGE_CONFIG['7d'];
}

function formatBucketLabel(date, formatter, unit, index, total) {
  if (unit === 'hour') {
    const hourLabel = formatter.format(date);
    if (index === total - 1) {
      return 'Now';
    }
    return hourLabel;
  }

  return formatter.format(date);
}

export function getRangeStart(rangeKey, now = new Date()) {
  const range = getRangeConfig(rangeKey);
  const start = new Date(now);

  if (range.unit === 'hour') {
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() - (range.bucketCount - 1));
    return start;
  }

  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (range.bucketCount - 1));
  return start;
}

export function filterItemsByRange(items, rangeKey, getDateValue) {
  const start = getRangeStart(rangeKey);
  return items.filter((item) => {
    const itemDate = normalizeDate(getDateValue(item));
    return itemDate && itemDate >= start;
  });
}

export function buildTrendSeries(scans, rangeKey) {
  const range = getRangeConfig(rangeKey);
  const now = new Date();
  const start = getRangeStart(rangeKey, now);
  const buckets = Array.from({ length: range.bucketCount }, (_, index) => {
    const bucketStart = new Date(start);
    if (range.unit === 'hour') {
      bucketStart.setHours(start.getHours() + index);
      bucketStart.setMinutes(0, 0, 0);
    } else {
      bucketStart.setDate(start.getDate() + index);
      bucketStart.setHours(0, 0, 0, 0);
    }

    const bucketEnd = new Date(bucketStart);
    if (range.unit === 'hour') {
      bucketEnd.setHours(bucketStart.getHours() + 1);
    } else {
      bucketEnd.setDate(bucketStart.getDate() + 1);
    }

    return {
      key: bucketStart.toISOString(),
      label: formatBucketLabel(bucketStart, range.formatter, range.unit, index, range.bucketCount),
      bucketStart,
      bucketEnd,
      scans: 0,
      flagged: 0,
      riskActivity: 0,
    };
  });

  scans.forEach((scan) => {
    const scanDate = normalizeDate(scan.scannedAt);
    if (!scanDate || scanDate < start || scanDate > now) {
      return;
    }

    const bucketIndex = buckets.findIndex(
      (bucket) => scanDate >= bucket.bucketStart && scanDate < bucket.bucketEnd,
    );

    if (bucketIndex === -1) {
      return;
    }

    const bucket = buckets[bucketIndex];
    bucket.scans += 1;
    if (['High', 'Critical'].includes(scan.riskLevel)) {
      bucket.flagged += 1;
    }
    bucket.riskActivity += scan.riskScore ?? 0;
  });

  return buckets.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    scans: bucket.scans,
    flagged: bucket.flagged,
    riskActivity: bucket.scans ? Math.round(bucket.riskActivity / bucket.scans) : 0,
  }));
}

function formatRelativeDate(dateValue) {
  if (!dateValue) {
    return 'Recently trusted';
  }

  const date = normalizeDate(dateValue);
  if (!date) {
    return 'Recently trusted';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function humanizeSource(source = '') {
  return source
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function buildTrustedDomainItems(trustedSites, scans) {
  return trustedSites.map((site) => {
    const matchingScan = scans.find(
      (scan) =>
        scan.rootDomain === site.domain ||
        scan.hostname === site.domain ||
        scan.url?.includes(site.domain),
    );

    return {
      ...site,
      href: matchingScan?.id ? `/threat-details/${matchingScan.id}` : `https://${site.domain}`,
      isInternal: Boolean(matchingScan?.id),
      faviconUrl:
        matchingScan?.faviconUrl ||
        `https://www.google.com/s2/favicons?domain=${encodeURIComponent(site.domain)}&sz=64`,
      dateLabel: formatRelativeDate(site.addedAt),
      sourceLabel: humanizeSource(site.source || 'web'),
      reportId: matchingScan?.id ?? null,
      riskLevel: matchingScan?.riskLevel ?? 'Low',
    };
  });
}

function createSparkline(values) {
  if (!values.some((value) => value > 0)) {
    return [0, 0, 0, 0, 0, 0, 0];
  }

  return values;
}

export function buildFlaggedDomainItems(scans, rangeKey, limit = 5) {
  const filtered = filterItemsByRange(scans, rangeKey, (scan) => scan.scannedAt).filter((scan) =>
    ['High', 'Critical'].includes(scan.riskLevel),
  );

  const byDomain = new Map();
  filtered.forEach((scan) => {
    const domain = scan.rootDomain || scan.hostname;
    if (!domain) {
      return;
    }

    const existing = byDomain.get(domain) ?? {
      domain,
      count: 0,
      maxRiskScore: 0,
      riskLevel: scan.riskLevel,
      latestScanId: scan.id,
      lastSeen: scan.scannedAt,
      sparkline: Array.from({ length: 7 }, () => 0),
    };

    existing.count += 1;
    existing.maxRiskScore = Math.max(existing.maxRiskScore, scan.riskScore ?? 0);
    if (scan.riskLevel === 'Critical' || existing.riskLevel !== 'Critical') {
      existing.riskLevel = scan.riskLevel;
    }
    if (new Date(scan.scannedAt) > new Date(existing.lastSeen)) {
      existing.lastSeen = scan.scannedAt;
      existing.latestScanId = scan.id;
    }

    const daysAgo = Math.floor((Date.now() - new Date(scan.scannedAt).getTime()) / (1000 * 60 * 60 * 24));
    const sparkIndex = 6 - Math.min(6, Math.max(0, daysAgo));
    existing.sparkline[sparkIndex] += 1;

    byDomain.set(domain, existing);
  });

  return [...byDomain.values()]
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      return right.maxRiskScore - left.maxRiskScore;
    })
    .slice(0, limit)
    .map((item, index) => ({
      ...item,
      rank: index + 1,
      href: `/threat-details/${item.latestScanId}`,
      sparkline: createSparkline(item.sparkline),
      lastSeenLabel: formatRelativeDate(item.lastSeen),
    }));
}

export function buildResponseActionItems(scans, actions, feedback, rangeKey) {
  const filteredScans = filterItemsByRange(scans, rangeKey, (scan) => scan.scannedAt);
  const filteredActions = filterItemsByRange(actions, rangeKey, (action) => action.createdAt);
  const filteredFeedback = filterItemsByRange(feedback, rangeKey, (item) => item.createdAt);

  const counts = new Map();

  if (filteredActions.length) {
    filteredActions.forEach((action) => {
      counts.set(action.actionType, (counts.get(action.actionType) ?? 0) + 1);
    });
  } else {
    filteredScans.forEach((scan) => {
      if (!scan.userAction) {
        return;
      }
      counts.set(scan.userAction, (counts.get(scan.userAction) ?? 0) + 1);
    });
  }

  const falsePositiveCount = filteredFeedback.filter(
    (item) => item.feedbackType === 'false_positive',
  ).length;

  if (falsePositiveCount) {
    counts.set('false_positive', falsePositiveCount);
  }

  const items = Object.entries(ACTION_DISPLAY).map(([key, config]) => ({
    key,
    label: config.label,
    tone: config.tone,
    accent: config.accent,
    value: counts.get(key) ?? 0,
  }));

  const total = items.reduce((sum, item) => sum + item.value, 0);

  return items
    .filter((item) => item.value > 0 || total === 0)
    .map((item) => ({
      ...item,
      percentage: total ? Math.round((item.value / total) * 100) : 0,
    }));
}
