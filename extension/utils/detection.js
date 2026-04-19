const suspiciousKeywords = ['verify', 'urgent', 'reset', 'claim', 'prize', 'free', 'login', 'secure-update'];
const phishingPhrases = [
  'verify your account',
  'confirm your identity',
  'account suspended',
  'claim your reward',
  'limited time',
  'act now',
  'password reset',
  'unusual activity',
];

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

function extractRootDomain(hostname = '') {
  const parts = hostname.split('.').filter(Boolean);
  if (parts.length <= 2) {
    return hostname;
  }

  return parts.slice(-2).join('.');
}

function classifyRiskLevel(score) {
  if (score <= 24) return 'Low';
  if (score <= 49) return 'Medium';
  if (score <= 74) return 'High';
  return 'Critical';
}

function buildRecommendations(scan) {
  const recommendations = new Set();

  if (scan.trustedStatus) {
    recommendations.add('This domain is allowlisted, but you should still confirm unusual prompts.');
  }

  if (['phishing suspected', 'suspicious login', 'impersonation domain'].includes(scan.threatCategory)) {
    recommendations.add('Avoid entering credentials on this page.');
    recommendations.add('Verify the domain against the official website.');
    recommendations.add('Use MFA on the legitimate account if you are unsure.');
  }

  if (scan.threatCategory === 'insecure connection') {
    recommendations.add('Leave the page and only continue on HTTPS.');
  }

  if (scan.threatCategory === 'tracker-heavy') {
    recommendations.add('Reduce interaction until you review the site privacy posture.');
  }

  if (scan.threatCategory === 'excessive redirects') {
    recommendations.add('Open the destination manually from a trusted bookmark if possible.');
  }

  if (scan.riskLevel === 'High' || scan.riskLevel === 'Critical') {
    recommendations.add('Leave the page if it is unexpected or pressuring urgent action.');
  }

  if (!recommendations.size) {
    recommendations.add('Continue carefully and re-check the domain before trusting the site.');
  }

  return [...recommendations];
}

function buildShortWarning(scan) {
  if (scan.trustedStatus) {
    return 'This domain is trusted, but BrowseShield still observed caution-worthy signals.';
  }

  if (scan.riskLevel === 'Critical') return 'Strong phishing indicators detected. Do not trust this page.';
  if (scan.riskLevel === 'High') return 'Several suspicious signals were found. Proceed with extreme caution.';
  if (scan.riskLevel === 'Medium') return 'Some warning signs were found. Verify the site before interacting.';
  return 'Only low-confidence issues were detected in this scan.';
}

function buildThreatCategories({ url, text, hasLoginForm, trackerCount, redirectCount, hyphenCount, numberCount }) {
  const categories = new Set();

  if (text) categories.add('deceptive wording');
  if (url.some((keyword) => ['verify', 'urgent', 'claim', 'prize'].includes(keyword)) || text) {
    categories.add('phishing suspected');
  }
  if (hasLoginForm && (url.length || text)) {
    categories.add('suspicious login');
  }
  if (url.http) categories.add('insecure connection');
  if (hyphenCount >= 3 || (hyphenCount >= 2 && numberCount >= 1)) categories.add('impersonation domain');
  if (trackerCount >= 4) categories.add('tracker-heavy');
  if (redirectCount >= 2) categories.add('excessive redirects');

  return [...categories];
}

export function detectPageThreat(pageInput) {
  const url = pageInput.url ?? '';
  const title = pageInput.title ?? 'Untitled page';
  const textContent = (pageInput.textContent ?? '').toLowerCase();
  const parsed = parseUrl(url);
  const hostname = parsed?.hostname.toLowerCase() ?? '';
  const pathname = parsed?.pathname ?? '';
  const indicators = [];
  let score = 0;

  const matchedKeywords = suspiciousKeywords.filter((keyword) =>
    `${hostname}${pathname}`.toLowerCase().includes(keyword),
  );
  const titlePhraseMatches = phishingPhrases.filter((phrase) => title.toLowerCase().includes(phrase));
  const bodyPhraseMatches = phishingPhrases.filter((phrase) => textContent.includes(phrase));
  const hyphenCount = (hostname.match(/-/g) ?? []).length;
  const numberCount = (hostname.match(/\d/g) ?? []).length;

  if (url.startsWith('http://')) {
    indicators.push('Insecure HTTP connection');
    score += 22;
  }

  if (url.length > 75) {
    indicators.push('Unusually long URL');
    score += url.length > 120 ? 18 : 10;
  }

  matchedKeywords.forEach((keyword) => {
    indicators.push(`Suspicious keyword in URL: ${keyword}`);
    score += 7;
  });

  if (hyphenCount >= 3) {
    indicators.push('Domain contains excessive hyphens');
    score += 10;
  }

  if (numberCount >= 4) {
    indicators.push('Domain contains multiple numbers');
    score += 8;
  }

  if (hyphenCount >= 2 && numberCount >= 1) {
    indicators.push('Domain structure resembles an impersonation pattern');
    score += 10;
  }

  if (titlePhraseMatches.length) {
    indicators.push(`Phishing-style title wording detected: ${titlePhraseMatches[0]}`);
    score += 14;
  }

  if (bodyPhraseMatches.length) {
    indicators.push(`Phishing-style page wording detected: ${bodyPhraseMatches[0]}`);
    score += 12;
  }

  if (pageInput.hasLoginForm) {
    indicators.push(
      indicators.length ? 'Login form detected on suspicious-looking page' : 'Login form detected on page',
    );
    score += indicators.length ? 18 : 6;
  }

  if ((pageInput.trackerCount ?? 0) >= 4) {
    indicators.push(`Tracker-heavy page detected (${pageInput.trackerCount} tracker-like assets)`);
    score += pageInput.trackerCount > 8 ? 18 : 10;
  }

  if ((pageInput.redirectCount ?? 0) >= 2) {
    indicators.push(`Excessive redirects detected (${pageInput.redirectCount})`);
    score += pageInput.redirectCount >= 4 ? 14 : 8;
  }

  const riskScore = clampScore(score);
  const riskLevel = classifyRiskLevel(riskScore);
  const threatCategories = buildThreatCategories({
    url: {
      list: matchedKeywords,
      http: url.startsWith('http://'),
      some: (predicate) => matchedKeywords.some(predicate),
      length: matchedKeywords.length,
    },
    text: Boolean(titlePhraseMatches.length || bodyPhraseMatches.length),
    hasLoginForm: pageInput.hasLoginForm,
    trackerCount: pageInput.trackerCount ?? 0,
    redirectCount: pageInput.redirectCount ?? 0,
    hyphenCount,
    numberCount,
  });
  const threatCategory =
    [
      'phishing suspected',
      'suspicious login',
      'impersonation domain',
      'insecure connection',
      'excessive redirects',
      'deceptive wording',
      'tracker-heavy',
    ].find((item) => threatCategories.includes(item)) ?? (riskLevel === 'Low' ? 'safe' : 'suspicious activity');

  const scan = {
    url,
    title,
    indicators,
    riskScore,
    riskLevel,
    threatType: threatCategory,
    threatCategory,
    threatCategories,
    summary:
      riskLevel === 'Low'
        ? 'This page showed only low-confidence risk indicators during the latest scan.'
        : `This page was classified as ${riskLevel.toLowerCase()} risk because it triggered ${indicators
            .slice(0, 3)
            .join(', ')
            .toLowerCase()}.`,
    explanation: '',
    scannedAt: new Date().toISOString(),
    source: 'extension',
    userAction: riskLevel === 'Low' ? 'warned' : 'warned',
    hasLoginForm: Boolean(pageInput.hasLoginForm),
    loginFormDetected: Boolean(pageInput.hasLoginForm),
    trackerCount: Number(pageInput.trackerCount ?? 0),
    redirectCount: Number(pageInput.redirectCount ?? 0),
    suspiciousKeywords: matchedKeywords,
    trustedStatus: false,
    protocol: parsed?.protocol.replace(':', '') ?? 'unknown',
    hostname,
    rootDomain: extractRootDomain(hostname),
    domainLength: hostname.length,
    subdomainDepth: Math.max(0, hostname.split('.').filter(Boolean).length - 2),
    faviconUrl: pageInput.faviconUrl ?? (parsed ? `${parsed.origin}/favicon.ico` : ''),
    pageFingerprint:
      pageInput.pageFingerprint ??
      [extractRootDomain(hostname), title, pageInput.hasLoginForm ? 'login' : 'no-login']
        .join('|')
        .toLowerCase(),
  };

  scan.recommendations = buildRecommendations(scan);
  scan.warningMessage = buildShortWarning(scan);
  scan.explanation = `${scan.summary} ${scan.recommendations[0] ?? ''}`.trim();
  scan.aiExplanation = `BrowseShield AI review: ${scan.explanation}`;

  return scan;
}

export function applyTrustedSiteAdjustment(scan, trustedSite) {
  if (!trustedSite) {
    return scan;
  }

  const riskScore = clampScore(Math.max(0, scan.riskScore - 18));
  const riskLevel = classifyRiskLevel(riskScore);

  return {
    ...scan,
    trustedStatus: true,
    riskScore,
    riskLevel,
    indicators: [...scan.indicators, `Trusted allowlist match: ${trustedSite.domain}`],
    warningMessage: 'This domain is trusted, but BrowseShield still logged the scan for visibility.',
    recommendations: [
      'Trusted site recorded. Continue only if the content still looks expected.',
      ...scan.recommendations,
    ],
  };
}
