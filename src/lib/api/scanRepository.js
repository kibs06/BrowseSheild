import { seedScanResults } from '../../data/mockData';
import { buildActionBreakdown, buildScanTrend, buildTopDomains } from '../analytics/dashboardAnalytics';
import { buildDomainIntelligence } from '../detection/engine';
import { isSupabaseConfigured } from '../config';
import { getSupabaseClient } from '../supabase';
import { generateAiExplanation } from '../../services/explanationService';
import { buildRecommendations } from '../../services/recommendationService';
import { listScanFeedback } from '../../services/feedback';
import { listScanActions } from '../../services/scanActions';
import { addTrustedSite, getTrustedSite, listTrustedSites } from '../../services/trustedSites';

const STORAGE_KEY = 'browseshield-demo-scans';
const RISK_ORDER = {
  Low: 1,
  Medium: 2,
  High: 3,
  Critical: 4,
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sortByNewest(scans) {
  return [...scans].sort((left, right) => new Date(right.scannedAt) - new Date(left.scannedAt));
}

function getStoredDemoScans() {
  if (typeof window === 'undefined') {
    return sortByNewest(seedScanResults);
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return sortByNewest(seedScanResults);
  }

  try {
    const parsed = JSON.parse(raw);
    return sortByNewest(parsed);
  } catch {
    return sortByNewest(seedScanResults);
  }
}

function persistDemoScans(scans) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sortByNewest(scans)));
}

function normalizeScan(scan) {
  const mapped = {
    id: scan.id,
    url: scan.url,
    title: scan.title || 'Untitled page',
    riskLevel: scan.riskLevel || scan.risk_level,
    riskScore: scan.riskScore ?? scan.risk_score ?? scan.score ?? 0,
    indicators: scan.indicators ?? [],
    summary: scan.summary ?? '',
    explanation: scan.explanation ?? '',
    aiExplanation: scan.aiExplanation ?? scan.ai_explanation ?? '',
    recommendations: scan.recommendations ?? [],
    threatType: scan.threatType ?? scan.threat_type ?? scan.threatCategory ?? scan.threat_category ?? 'suspicious activity',
    threatCategory:
      scan.threatCategory ?? scan.threat_category ?? scan.threatType ?? scan.threat_type ?? 'suspicious activity',
    threatCategories: scan.threatCategories ?? scan.threat_categories ?? [],
    userAction: scan.userAction ?? scan.user_action ?? 'Pending review',
    source: scan.source ?? 'extension',
    notes: scan.notes ?? '',
    trustedStatus: Boolean(scan.trustedStatus ?? scan.trusted_status),
    hasLoginForm: Boolean(scan.hasLoginForm ?? scan.has_login_form ?? scan.loginFormDetected ?? scan.login_form_detected),
    loginFormDetected: Boolean(scan.loginFormDetected ?? scan.login_form_detected ?? scan.hasLoginForm ?? scan.has_login_form),
    trackerCount: Number(scan.trackerCount ?? scan.tracker_count ?? 0),
    redirectCount: Number(scan.redirectCount ?? scan.redirect_count ?? 0),
    suspiciousKeywords: scan.suspiciousKeywords ?? scan.suspicious_keywords ?? [],
    protocol: scan.protocol ?? '',
    hostname: scan.hostname ?? '',
    rootDomain: scan.rootDomain ?? scan.root_domain ?? '',
    domainLength: Number(scan.domainLength ?? scan.domain_length ?? 0),
    subdomainDepth: Number(scan.subdomainDepth ?? scan.subdomain_depth ?? 0),
    faviconUrl: scan.faviconUrl ?? scan.favicon_url ?? '',
    pageFingerprint: scan.pageFingerprint ?? scan.page_fingerprint ?? '',
    scannedAt: scan.scannedAt ?? scan.scanned_at ?? scan.createdAt ?? scan.created_at ?? new Date().toISOString(),
    createdAt: scan.createdAt ?? scan.created_at ?? scan.scannedAt ?? scan.scanned_at ?? new Date().toISOString(),
  };

  const intelligence = buildDomainIntelligence(mapped);

  return {
    ...mapped,
    threatCategories: mapped.threatCategories.length
      ? mapped.threatCategories
      : mapped.threatCategory && mapped.threatCategory !== 'safe'
        ? [mapped.threatCategory]
        : [],
    suspiciousKeywords: mapped.suspiciousKeywords.length
      ? mapped.suspiciousKeywords
      : intelligence.suspiciousKeywords,
    protocol: mapped.protocol || intelligence.protocol,
    hostname: mapped.hostname || intelligence.hostname,
    rootDomain: mapped.rootDomain || intelligence.rootDomain,
    domainLength: mapped.domainLength || intelligence.domainLength,
    subdomainDepth: mapped.subdomainDepth || intelligence.subdomainDepth,
    faviconUrl: mapped.faviconUrl || intelligence.faviconUrl,
    pageFingerprint: mapped.pageFingerprint || intelligence.pageFingerprint,
  };
}

function toInsertPayload(scan) {
  return {
    url: scan.url,
    title: scan.title,
    risk_level: scan.riskLevel,
    risk_score: scan.riskScore,
    indicators: scan.indicators,
    summary: scan.summary,
    explanation: scan.explanation,
    ai_explanation: scan.aiExplanation,
    recommendations: scan.recommendations,
    threat_type: scan.threatType,
    threat_category: scan.threatCategory,
    threat_categories: scan.threatCategories,
    user_action: scan.userAction,
    source: scan.source,
    notes: scan.notes,
    trusted_status: scan.trustedStatus,
    has_login_form: scan.hasLoginForm,
    login_form_detected: scan.loginFormDetected,
    tracker_count: scan.trackerCount,
    redirect_count: scan.redirectCount,
    suspicious_keywords: scan.suspiciousKeywords,
    protocol: scan.protocol,
    hostname: scan.hostname,
    root_domain: scan.rootDomain,
    domain_length: scan.domainLength,
    subdomain_depth: scan.subdomainDepth,
    favicon_url: scan.faviconUrl,
    page_fingerprint: scan.pageFingerprint,
    scanned_at: scan.scannedAt,
  };
}

function matchesFilters(
  scan,
  { threatType = 'all', threatCategory = 'all', riskLevel = 'all', userAction = 'all', trustedStatus = 'all', search = '' } = {},
) {
  const normalizedSearch = search.trim().toLowerCase();

  const matchesThreatType = threatType === 'all' ? true : scan.threatType === threatType;
  const matchesThreatCategory = threatCategory === 'all' ? true : scan.threatCategory === threatCategory;
  const matchesRiskLevel = riskLevel === 'all' ? true : scan.riskLevel === riskLevel;
  const matchesAction = userAction === 'all' ? true : scan.userAction === userAction;
  const matchesTrustedStatus =
    trustedStatus === 'all'
      ? true
      : trustedStatus === 'trusted'
        ? scan.trustedStatus
        : !scan.trustedStatus;
  const matchesSearch = normalizedSearch
    ? [
        scan.url,
        scan.title,
        scan.hostname,
        scan.rootDomain,
        scan.threatCategory,
        scan.userAction,
      ]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedSearch))
    : true;

  return (
    matchesThreatType &&
    matchesThreatCategory &&
    matchesRiskLevel &&
    matchesAction &&
    matchesTrustedStatus &&
    matchesSearch
  );
}

function computeThreatStats(scans) {
  const buckets = new Map();

  scans.forEach((scan) => {
    const current = buckets.get(scan.threatCategory) ?? 0;
    buckets.set(scan.threatCategory, current + 1);
  });

  return [...buckets.entries()]
    .map(([label, value]) => ({
      label,
      value,
      tone:
        label === 'safe'
          ? 'safe'
          : label === 'tracker-heavy'
            ? 'warning'
            : label === 'insecure connection'
              ? 'primary'
              : 'danger',
    }))
    .sort((left, right) => right.value - left.value);
}

function isAlert(scan) {
  return RISK_ORDER[scan.riskLevel] >= RISK_ORDER.High;
}

function formatAlert(scan) {
  return {
    id: scan.id,
    title: scan.title,
    url: scan.url,
    time: scan.scannedAt,
    severity: scan.riskLevel.toLowerCase(),
    detail: scan.summary,
    riskLevel: scan.riskLevel,
  };
}

function buildProtectionStatus(scans, trustedDomainsCount) {
  if (!scans.length) {
    return {
      extension: 'Awaiting scan',
      protection: isSupabaseConfigured() ? 'Listening for extension scans' : 'Demo mode',
      alertsToday: 0,
      trustedDomainsCount,
    };
  }

  const latest = scans[0];
  const minutesSinceLatest = Math.round(
    (Date.now() - new Date(latest.scannedAt).getTime()) / (1000 * 60),
  );

  return {
    extension: latest.source === 'extension' ? 'Connected' : 'Manual / demo source',
    protection: latest.trustedStatus
      ? 'Trusted-site monitoring'
      : minutesSinceLatest <= 10
        ? 'Active Shielding'
        : 'Idle - awaiting fresh scan',
    alertsToday: scans.filter((scan) => {
      const sameDay = new Date(scan.scannedAt).toDateString() === new Date().toDateString();
      return sameDay && isAlert(scan);
    }).length,
    trustedDomainsCount,
  };
}

function mergeTrustedSites(scans, trustedSites) {
  const merged = new Map();

  trustedSites.forEach((site) => {
    if (!site?.domain) {
      return;
    }

    merged.set(site.domain, site);
  });

  scans.forEach((scan) => {
    if (!scan?.trustedStatus) {
      return;
    }

    const domain = scan.rootDomain || scan.hostname;
    if (!domain || merged.has(domain)) {
      return;
    }

    merged.set(domain, {
      id: `trusted-scan-${scan.id}`,
      domain,
      reason: 'Trusted via saved scan status',
      source: scan.source ?? 'extension',
      notes: '',
      addedAt: scan.createdAt ?? scan.scannedAt,
    });
  });

  return [...merged.values()].sort(
    (left, right) => new Date(right.addedAt ?? 0) - new Date(left.addedAt ?? 0),
  );
}

export async function listScanResults(filters = {}) {
  const { limit = 100 } = filters;
  const supabase = getSupabaseClient();

  if (!supabase) {
    const scans = sortByNewest(getStoredDemoScans().map(normalizeScan))
      .filter((scan) => matchesFilters(scan, filters))
      .slice(0, limit);
    return clone(scans);
  }

  const { data, error } = await supabase
    .from('scan_results')
    .select('*')
    .order('scanned_at', { ascending: false })
    .limit(Math.max(limit, 200));

  if (error) {
    throw error;
  }

  return data
    .map(normalizeScan)
    .filter((scan) => matchesFilters(scan, filters))
    .slice(0, limit);
}

export async function getScanById(scanId) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    const found = getStoredDemoScans().map(normalizeScan).find((scan) => scan.id === scanId);
    return found ? clone(found) : null;
  }

  const { data, error } = await supabase
    .from('scan_results')
    .select('*')
    .eq('id', scanId)
    .single();

  if (error) {
    throw error;
  }

  return normalizeScan(data);
}

export async function getLatestScan() {
  const scans = await listScanResults({ limit: 1 });
  return scans[0] ?? null;
}

export async function getThreatReport(scanId) {
  const scan = scanId ? await getScanById(scanId) : await getLatestScan();
  if (!scan) {
    return null;
  }

  const [actions, feedback, trustedSite] = await Promise.all([
    listScanActions(scan.id),
    listScanFeedback(scan.id),
    getTrustedSite(scan.rootDomain || scan.hostname),
  ]);

  return {
    ...scan,
    actions,
    feedback,
    trustedSite,
    latestFeedback: feedback[0] ?? null,
    latestAction: actions[0]?.actionType ?? scan.userAction,
  };
}

export async function getDashboardData() {
  const [scans, trustedSites, actions, feedback] = await Promise.all([
    listScanResults({ limit: 200 }),
    listTrustedSites(),
    listScanActions(),
    listScanFeedback(),
  ]);

  const latestScan = scans[0] ?? null;
  const mergedTrustedSites = mergeTrustedSites(scans, trustedSites);
  const recentAlerts = scans.filter(isAlert).slice(0, 4).map(formatAlert);
  const threatStats = computeThreatStats(scans).slice(0, 6);
  const status = buildProtectionStatus(scans, mergedTrustedSites.length);

  const mostCommonThreatCategory =
    threatStats.sort((left, right) => right.value - left.value)[0]?.label ?? 'safe';
  const scansToday = scans.filter(
    (scan) => new Date(scan.scannedAt).toDateString() === new Date().toDateString(),
  ).length;
  const flaggedToday = scans.filter(
    (scan) =>
      new Date(scan.scannedAt).toDateString() === new Date().toDateString() &&
      ['High', 'Critical'].includes(scan.riskLevel),
  ).length;
  const highRiskThisWeek = scans.filter((scan) => {
    const scanDate = new Date(scan.scannedAt);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return scanDate >= sevenDaysAgo && ['High', 'Critical'].includes(scan.riskLevel);
  }).length;

  return {
    mode: isSupabaseConfigured() ? 'supabase' : 'demo',
    latestScan,
    recentAlerts,
    threatStats,
    actions,
    feedback,
    trustedSites: mergedTrustedSites,
    status,
    recommendations: latestScan?.recommendations ?? [],
    scans,
    analytics: {
      scansToday,
      flaggedToday,
      highRiskThisWeek,
      mostCommonThreatCategory,
      trustedDomainsCount: mergedTrustedSites.length,
      falsePositiveCount: feedback.filter((item) => item.feedbackType === 'false_positive').length,
      actionBreakdown: buildActionBreakdown(actions),
      scanTrend: buildScanTrend(scans),
      topFlaggedDomains: buildTopDomains(scans),
    },
  };
}

export async function createScanResult(scan) {
  const normalized = normalizeScan(scan);
  const trustedSite = normalized.trustedStatus
    ? { domain: normalized.rootDomain || normalized.hostname }
    : await getTrustedSite(normalized.rootDomain || normalized.hostname).catch(() => null);

  const enriched = {
    ...normalized,
    trustedStatus: normalized.trustedStatus || Boolean(trustedSite),
    recommendations: normalized.recommendations?.length
      ? normalized.recommendations
      : buildRecommendations({
          ...normalized,
          trustedStatus: normalized.trustedStatus || Boolean(trustedSite),
        }),
  };

  if (!enriched.aiExplanation) {
    const aiExplanation = await generateAiExplanation(enriched);
    enriched.aiExplanation = aiExplanation.text;
    enriched.explanation = aiExplanation.threatNarrative;
  }

  const supabase = getSupabaseClient();

  if (!supabase) {
    const current = getStoredDemoScans().map(normalizeScan);
    const record = {
      ...enriched,
      id: enriched.id ?? `demo-${crypto.randomUUID()}`,
      createdAt: enriched.createdAt ?? enriched.scannedAt,
    };
    persistDemoScans([record, ...current]);
    return clone(record);
  }

  const { data, error } = await supabase
    .from('scan_results')
    .insert(toInsertPayload(enriched))
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return normalizeScan(data);
}

export async function markScanDomainTrusted(scan, notes = '') {
  const trustedSite = await addTrustedSite({
    domain: scan.rootDomain || scan.hostname || scan.url,
    reason: 'Trusted through BrowseShield workflow',
    source: 'web',
    notes,
  });

  const supabase = getSupabaseClient();

  if (!supabase) {
    const scans = getStoredDemoScans().map(normalizeScan);
    const updated = scans.map((item) =>
      item.id === scan.id
        ? { ...item, trustedStatus: true, userAction: 'trusted_site' }
        : item.rootDomain === trustedSite.domain || item.hostname === trustedSite.domain
          ? { ...item, trustedStatus: true }
          : item,
    );
    persistDemoScans(updated);
    return trustedSite;
  }

  await supabase
    .from('scan_results')
    .update({
      trusted_status: true,
      user_action: 'trusted_site',
    })
    .or(`id.eq.${scan.id},root_domain.eq.${trustedSite.domain},hostname.eq.${trustedSite.domain}`);

  return trustedSite;
}
