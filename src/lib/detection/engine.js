import {
  phishingPhrases,
  riskThresholds,
  suspiciousKeywords,
  trackerKeywords,
} from './constants';

function clampScore(score) {
  return Math.max(0, Math.min(100, score));
}

function parseUrl(url) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function safeHostname(url) {
  return parseUrl(url)?.hostname.toLowerCase() ?? '';
}

function splitHostname(hostname) {
  return hostname.split('.').filter(Boolean);
}

export function extractRootDomain(hostname = '') {
  const parts = splitHostname(hostname);
  if (parts.length <= 2) {
    return hostname;
  }

  return parts.slice(-2).join('.');
}

export function buildDomainIntelligence(pageInput) {
  const parsed = parseUrl(pageInput.url ?? '');
  const hostname = parsed?.hostname.toLowerCase() ?? '';
  const pathname = parsed?.pathname ?? '';
  const rootDomain = extractRootDomain(hostname);
  const segments = splitHostname(hostname);
  const subdomainDepth = Math.max(0, segments.length - 2);
  const matchedKeywords = suspiciousKeywords.filter((keyword) =>
    `${hostname}${pathname}`.toLowerCase().includes(keyword),
  );

  return {
    protocol: parsed?.protocol.replace(':', '') ?? 'unknown',
    hostname,
    rootDomain,
    domainLength: hostname.length,
    subdomainDepth,
    suspiciousKeywords: matchedKeywords,
    faviconUrl:
      pageInput.faviconUrl ??
      (parsed ? `${parsed.origin}/favicon.ico` : ''),
    pageFingerprint:
      pageInput.pageFingerprint ??
      [rootDomain, pageInput.title ?? 'untitled', pageInput.hasLoginForm ? 'login' : 'no-login']
        .join('|')
        .toLowerCase(),
  };
}

export function classifyRiskLevel(score) {
  if (score <= riskThresholds.low) {
    return 'Low';
  }

  if (score <= riskThresholds.medium) {
    return 'Medium';
  }

  if (score <= riskThresholds.high) {
    return 'High';
  }

  return 'Critical';
}

export function analyzeUrlRisk(url) {
  const hostname = safeHostname(url);
  const indicators = [];
  const metadata = {
    matchedKeywords: [],
    domainHasManyHyphens: false,
    domainHasManyNumbers: false,
    impersonationRisk: false,
  };
  let score = 0;

  if (url.startsWith('http://')) {
    indicators.push('Insecure HTTP connection');
    score += 22;
  }

  if (url.length > 75) {
    indicators.push('Unusually long URL');
    score += url.length > 120 ? 18 : 10;
  }

  metadata.matchedKeywords = suspiciousKeywords.filter((keyword) =>
    url.toLowerCase().includes(keyword),
  );

  metadata.matchedKeywords.forEach((keyword) => {
    indicators.push(`Suspicious keyword in URL: ${keyword}`);
  });

  score += Math.min(metadata.matchedKeywords.length * 7, 21);

  const hyphenCount = (hostname.match(/-/g) ?? []).length;
  const numberCount = (hostname.match(/\d/g) ?? []).length;

  if (hyphenCount >= 3) {
    indicators.push('Domain contains excessive hyphens');
    score += 10;
    metadata.domainHasManyHyphens = true;
  }

  if (numberCount >= 4) {
    indicators.push('Domain contains multiple numbers');
    score += 8;
    metadata.domainHasManyNumbers = true;
  }

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    indicators.push('Direct IP address used instead of a domain');
    score += 18;
  }

  if (/[0-9]/.test(hostname) && hyphenCount >= 2) {
    indicators.push('Domain structure resembles an impersonation pattern');
    score += 10;
    metadata.impersonationRisk = true;
  }

  return { indicators, score, metadata };
}

export function analyzeTextRisk({ title = '', textContent = '' }) {
  const normalizedTitle = title.toLowerCase();
  const normalizedText = textContent.toLowerCase();
  const indicators = [];
  const metadata = {
    deceptiveWording: false,
    phishingPhraseMatches: [],
  };
  let score = 0;

  const titlePhraseMatches = phishingPhrases.filter((phrase) => normalizedTitle.includes(phrase));
  const bodyPhraseMatches = phishingPhrases.filter((phrase) => normalizedText.includes(phrase));
  metadata.phishingPhraseMatches = [...new Set([...titlePhraseMatches, ...bodyPhraseMatches])];

  if (titlePhraseMatches.length > 0) {
    indicators.push(`Phishing-style title wording detected: ${titlePhraseMatches[0]}`);
    score += 14;
    metadata.deceptiveWording = true;
  }

  if (bodyPhraseMatches.length > 0) {
    indicators.push(`Phishing-style page wording detected: ${bodyPhraseMatches[0]}`);
    score += 12;
    metadata.deceptiveWording = true;
  }

  return { indicators, score, metadata };
}

export function analyzeLoginRisk({ hasLoginForm, riskSignals }) {
  if (!hasLoginForm) {
    return { indicators: [], score: 0, metadata: { suspiciousLogin: false } };
  }

  if (riskSignals < 1) {
    return {
      indicators: ['Login form detected on page'],
      score: 6,
      metadata: { suspiciousLogin: false },
    };
  }

  return {
    indicators: ['Login form detected on suspicious-looking page'],
    score: 18,
    metadata: { suspiciousLogin: true },
  };
}

export function analyzeTrackerRisk({ trackerCount = 0, trackerMatches = [] }) {
  if (trackerCount < 4) {
    return { indicators: [], score: 0, metadata: { trackerHeavy: false } };
  }

  const indicators = [
    `Tracker-heavy page detected (${trackerCount} tracker-like requests or assets)`,
  ];

  if (trackerMatches.length > 0) {
    indicators.push(`Tracker keywords observed: ${trackerMatches.slice(0, 3).join(', ')}`);
  }

  return {
    indicators,
    score: trackerCount > 8 ? 18 : 10,
    metadata: { trackerHeavy: true },
  };
}

export function analyzeRedirectRisk(redirectCount = 0) {
  if (redirectCount < 2) {
    return { indicators: [], score: 0, metadata: { excessiveRedirects: false } };
  }

  return {
    indicators: [`Excessive redirects detected (${redirectCount})`],
    score: redirectCount >= 4 ? 14 : 8,
    metadata: { excessiveRedirects: true },
  };
}

export function deriveThreatCategories({
  urlAnalysis,
  textAnalysis,
  loginAnalysis,
  trackerAnalysis,
  redirectAnalysis,
}) {
  const categories = new Set();

  if (textAnalysis.metadata.deceptiveWording) {
    categories.add('deceptive wording');
  }

  if (
    textAnalysis.metadata.phishingPhraseMatches.length ||
    urlAnalysis.metadata.matchedKeywords.some((keyword) => ['verify', 'urgent', 'claim', 'prize'].includes(keyword))
  ) {
    categories.add('phishing suspected');
  }

  if (loginAnalysis.metadata.suspiciousLogin) {
    categories.add('suspicious login');
  }

  if (urlAnalysis.indicators.includes('Insecure HTTP connection')) {
    categories.add('insecure connection');
  }

  if (urlAnalysis.metadata.impersonationRisk || urlAnalysis.metadata.domainHasManyHyphens) {
    categories.add('impersonation domain');
  }

  if (trackerAnalysis.metadata.trackerHeavy) {
    categories.add('tracker-heavy');
  }

  if (redirectAnalysis.metadata.excessiveRedirects) {
    categories.add('excessive redirects');
  }

  return [...categories];
}

export function derivePrimaryThreatCategory(categories, riskLevel) {
  const priority = [
    'phishing suspected',
    'suspicious login',
    'impersonation domain',
    'insecure connection',
    'excessive redirects',
    'deceptive wording',
    'tracker-heavy',
  ];

  const picked = priority.find((label) => categories.includes(label));
  if (picked) {
    return picked;
  }

  return riskLevel === 'Low' ? 'safe' : 'suspicious activity';
}

export function buildSummary({ riskLevel, indicators, threatCategory, trustedStatus }) {
  if (trustedStatus) {
    return `This site is on your trusted allowlist. BrowseShield still recorded the scan and lowered the response urgency, but noted ${indicators
      .slice(0, 2)
      .join(', ')
      .toLowerCase()}.`;
  }

  if (riskLevel === 'Low') {
    return 'This page showed only low-confidence risk indicators during the latest scan.';
  }

  const firstSignals = indicators.slice(0, 3).join(', ').toLowerCase();
  return `This page was classified as ${riskLevel.toLowerCase()} risk due to ${firstSignals}. Primary threat category: ${threatCategory}.`;
}

export function applyTrustedSiteAdjustment(scan, trustedSite) {
  if (!trustedSite) {
    return {
      ...scan,
      trustedStatus: false,
      trustedDomain: null,
    };
  }

  const loweredScore = clampScore(Math.max(0, scan.riskScore - 18));
  const loweredLevel = classifyRiskLevel(loweredScore);

  return {
    ...scan,
    trustedStatus: true,
    trustedDomain: trustedSite.domain,
    riskScore: loweredScore,
    riskLevel: loweredLevel,
    indicators: [...scan.indicators, `Trusted allowlist match: ${trustedSite.domain}`],
    summary: buildSummary({
      riskLevel: loweredLevel,
      indicators: [...scan.indicators, `Trusted allowlist match: ${trustedSite.domain}`],
      threatCategory: scan.threatCategory,
      trustedStatus: true,
    }),
  };
}

export function detectPageThreat(pageInput) {
  const normalized = {
    url: pageInput.url ?? '',
    title: pageInput.title ?? 'Untitled page',
    textContent: pageInput.textContent ?? '',
    hasLoginForm: Boolean(pageInput.hasLoginForm),
    trackerCount: Number(pageInput.trackerCount ?? 0),
    trackerMatches: pageInput.trackerMatches ?? [],
    redirectCount: Number(pageInput.redirectCount ?? 0),
    faviconUrl: pageInput.faviconUrl ?? '',
    pageFingerprint: pageInput.pageFingerprint ?? '',
  };

  const urlAnalysis = analyzeUrlRisk(normalized.url);
  const textAnalysis = analyzeTextRisk(normalized);
  const riskSignals = urlAnalysis.indicators.length + textAnalysis.indicators.length;
  const loginAnalysis = analyzeLoginRisk({
    hasLoginForm: normalized.hasLoginForm,
    riskSignals,
  });
  const trackerAnalysis = analyzeTrackerRisk(normalized);
  const redirectAnalysis = analyzeRedirectRisk(normalized.redirectCount);
  const domainInfo = buildDomainIntelligence(normalized);

  const indicators = [
    ...urlAnalysis.indicators,
    ...textAnalysis.indicators,
    ...loginAnalysis.indicators,
    ...trackerAnalysis.indicators,
    ...redirectAnalysis.indicators,
  ];

  const categories = deriveThreatCategories({
    urlAnalysis,
    textAnalysis,
    loginAnalysis,
    trackerAnalysis,
    redirectAnalysis,
  });

  const score = clampScore(
    urlAnalysis.score +
      textAnalysis.score +
      loginAnalysis.score +
      trackerAnalysis.score +
      redirectAnalysis.score,
  );
  const riskLevel = classifyRiskLevel(score);
  const threatCategory = derivePrimaryThreatCategory(categories, riskLevel);

  return {
    url: normalized.url,
    title: normalized.title,
    indicators,
    riskScore: score,
    score,
    riskLevel,
    threatType: threatCategory,
    threatCategory,
    threatCategories: categories,
    hasLoginForm: normalized.hasLoginForm,
    loginFormDetected: normalized.hasLoginForm,
    trackerCount: normalized.trackerCount,
    redirectCount: normalized.redirectCount,
    suspiciousKeywords: [...new Set(domainInfo.suspiciousKeywords)],
    trustedStatus: false,
    protocol: domainInfo.protocol,
    hostname: domainInfo.hostname,
    rootDomain: domainInfo.rootDomain,
    domainLength: domainInfo.domainLength,
    subdomainDepth: domainInfo.subdomainDepth,
    faviconUrl: domainInfo.faviconUrl,
    pageFingerprint: domainInfo.pageFingerprint,
    summary: buildSummary({ riskLevel, indicators, threatCategory, trustedStatus: false }),
    scannedAt: new Date().toISOString(),
  };
}

export function collectTrackerMatches(textContent = '') {
  const lower = textContent.toLowerCase();
  return trackerKeywords.filter((keyword) => lower.includes(keyword));
}
