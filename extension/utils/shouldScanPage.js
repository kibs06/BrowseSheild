export const SCAN_COOLDOWN_MS = 2 * 60 * 1000;

export function normalizeScanUrl(url = '') {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return url;
  }
}

export function getLastScannedAt(cacheEntry) {
  if (typeof cacheEntry?.lastScannedAt === 'number' && Number.isFinite(cacheEntry.lastScannedAt)) {
    return cacheEntry.lastScannedAt;
  }

  if (typeof cacheEntry?.lastScannedAtMs === 'number' && Number.isFinite(cacheEntry.lastScannedAtMs)) {
    return cacheEntry.lastScannedAtMs;
  }

  const scannedAtValue = cacheEntry?.scannedAt;
  const parsedScannedAt = scannedAtValue ? Date.parse(scannedAtValue) : NaN;
  return Number.isFinite(parsedScannedAt) ? parsedScannedAt : 0;
}

export function shouldScanPage({
  url,
  now = Date.now(),
  cacheEntry = null,
  cooldownMs = SCAN_COOLDOWN_MS,
  manualRescan = false,
}) {
  const normalizedUrl = normalizeScanUrl(url);

  if (manualRescan) {
    return {
      shouldScan: true,
      reason: 'manual_rescan',
      normalizedUrl,
    };
  }

  if (!cacheEntry) {
    return {
      shouldScan: true,
      reason: 'new_page',
      normalizedUrl,
    };
  }

  const cachedUrl = normalizeScanUrl(cacheEntry.url || '');
  if (cachedUrl !== normalizedUrl) {
    return {
      shouldScan: true,
      reason: 'new_page',
      normalizedUrl,
    };
  }

  const lastScannedAt = getLastScannedAt(cacheEntry);
  if (!lastScannedAt) {
    return {
      shouldScan: true,
      reason: 'new_page',
      normalizedUrl,
    };
  }

  if (now - lastScannedAt >= cooldownMs) {
    return {
      shouldScan: true,
      reason: 'expired_rescan',
      normalizedUrl,
    };
  }

  return {
    shouldScan: false,
    reason: cacheEntry.notificationShown ? 'cached_skip' : 'cooldown_skip',
    normalizedUrl,
    remainingMs: cooldownMs - (now - lastScannedAt),
  };
}
