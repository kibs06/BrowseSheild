export const overviewStats = [
  { label: 'Protected sessions', value: '14.2k', trend: '+8.2%', tone: 'safe' },
  { label: 'Threats neutralized', value: '482', trend: '+21 today', tone: 'danger' },
  { label: 'Avg. scan latency', value: '184ms', trend: '-12ms', tone: 'primary' },
  { label: 'Analyst confidence', value: '98.4%', trend: 'Stable', tone: 'safe' },
];

export const features = [
  {
    title: 'Suspicious Website Detection',
    description:
      'Continuously evaluates URLs, page fingerprints, SSL posture, and deceptive patterns to identify risky browsing sessions in real time.',
    tag: 'Detection',
  },
  {
    title: 'Live Threat Alerts',
    description:
      'Streams elevated phishing, impersonation, tracker, and certificate anomalies into an analyst-grade alert feed.',
    tag: 'Response',
  },
  {
    title: 'Detection History',
    description:
      'Retains a searchable incident timeline of flagged domains, analyst actions, and mitigation outcomes.',
    tag: 'Forensics',
  },
  {
    title: 'AI Recommendations',
    description:
      'Explains risk signals in plain language and turns technical findings into clear browser hygiene guidance.',
    tag: 'AI Assist',
  },
];

export const workflowSteps = [
  {
    step: '01',
    title: 'Inspect the active browsing session',
    description:
      'BrowseShield ingests browser extension telemetry, domain intelligence, TLS posture, and page behavior indicators.',
  },
  {
    step: '02',
    title: 'Score the site in real time',
    description:
      'A weighted risk engine correlates suspicious indicators and assigns a threat level from low to critical.',
  },
  {
    step: '03',
    title: 'Explain and recommend',
    description:
      'Analyst-style summaries highlight why a site was flagged and what protective action should happen next.',
  },
];

export const seedScanResults = [
  {
    id: 'scan-24091',
    url: 'http://paypaI-auth-check.net/verify',
    title: 'Verify your PayPal account',
    riskLevel: 'Critical',
    riskScore: 86,
    indicators: [
      'Insecure HTTP connection',
      'Suspicious keyword in URL: verify',
      'Login form detected on suspicious-looking page',
      'Phishing-style title wording detected: verify your account',
    ],
    summary:
      'This page was classified as critical risk due to insecure transport, phishing-style wording, and a suspicious credential form.',
    explanation:
      'The page imitates a payment provider, requests credentials, and uses an untrusted domain over HTTP.',
    aiExplanation:
      'BrowseShield AI review: this page shows a strong phishing pattern and should not be trusted for account access.',
    recommendations: [
      'Avoid entering credentials or payment details on this page.',
      'Verify the domain spelling against the official website before taking action.',
      'Leave the page immediately if it is unexpected or requesting urgent action.',
    ],
    threatType: 'phishing',
    userAction: 'left_site',
    source: 'extension',
    notes: 'Lookalike domain with credential relay pattern.',
    hasLoginForm: true,
    trackerCount: 2,
    scannedAt: '2026-04-18T15:48:00.000Z',
    createdAt: '2026-04-18T15:48:00.000Z',
  },
  {
    id: 'scan-24087',
    url: 'https://discount-hub-market.site/free-prize',
    title: 'Claim your free prize today',
    riskLevel: 'High',
    riskScore: 67,
    indicators: [
      'Suspicious keyword in URL: free',
      'Suspicious keyword in URL: prize',
      'Phishing-style page wording detected: claim your reward',
      'Tracker-heavy page detected (9 tracker-like requests or assets)',
    ],
    summary:
      'This page was classified as high risk due to reward-bait language and an aggressive tracker profile.',
    explanation:
      'The site mixes prize-bait messaging with heavy third-party tracking, which is often used on deceptive landing pages.',
    aiExplanation:
      'BrowseShield AI review: the site uses urgency and reward language that often appears in scam funnels.',
    recommendations: [
      'Leave the page immediately if it is unexpected or requesting urgent action.',
      'Limit interaction until you review the site privacy posture and external scripts.',
    ],
    threatType: 'tracker-heavy',
    userAction: 'continued_anyway',
    source: 'extension',
    notes: 'Gift-card bait page with unusually noisy third-party script behavior.',
    hasLoginForm: false,
    trackerCount: 9,
    scannedAt: '2026-04-18T14:36:00.000Z',
    createdAt: '2026-04-18T14:36:00.000Z',
  },
  {
    id: 'scan-24080',
    url: 'http://portal-docs-cloud.cc/login/reset',
    title: 'Account suspended - reset now',
    riskLevel: 'High',
    riskScore: 74,
    indicators: [
      'Insecure HTTP connection',
      'Suspicious keyword in URL: login',
      'Suspicious keyword in URL: reset',
      'Phishing-style page wording detected: account suspended',
    ],
    summary:
      'This page was classified as high risk due to HTTP transport and suspicious account-reset wording.',
    explanation:
      'The login-reset workflow is being presented on an insecure, low-trust domain and uses pressure-heavy language.',
    aiExplanation:
      'BrowseShield AI review: this looks like an unsafe account recovery workflow and should be verified before use.',
    recommendations: [
      'Leave the page and return only over HTTPS on a trusted domain.',
      'Avoid entering credentials or payment details on this page.',
    ],
    threatType: 'insecure connection',
    userAction: 'warned',
    source: 'extension',
    notes: 'Insecure redirect chain observed before login.',
    hasLoginForm: true,
    trackerCount: 1,
    scannedAt: '2026-04-18T13:10:00.000Z',
    createdAt: '2026-04-18T13:10:00.000Z',
  },
  {
    id: 'scan-24071',
    url: 'https://secure-login-teamshare.app',
    title: 'Secure login portal',
    riskLevel: 'High',
    riskScore: 59,
    indicators: [
      'Domain contains excessive hyphens',
      'Suspicious keyword in URL: login',
      'Login form detected on suspicious-looking page',
    ],
    summary:
      'This page was classified as high risk because the login flow sits on a suspicious-looking lookalike domain.',
    explanation:
      'The site asks for credentials on a domain structure that does not look like a trusted enterprise login pattern.',
    aiExplanation:
      'BrowseShield AI review: the login request itself may be legitimate-looking, but the domain posture is weak enough to treat it cautiously.',
    recommendations: [
      'Verify the domain spelling against the official website before taking action.',
      'Use MFA on the real service in case credentials were exposed.',
    ],
    threatType: 'suspicious login',
    userAction: 'viewed_report',
    source: 'extension',
    notes: 'Lookalike SSO landing page.',
    hasLoginForm: true,
    trackerCount: 3,
    scannedAt: '2026-04-18T11:52:00.000Z',
    createdAt: '2026-04-18T11:52:00.000Z',
  },
  {
    id: 'scan-24065',
    url: 'https://workspace.acme-security.com',
    title: 'Acme Security Workspace',
    riskLevel: 'Low',
    riskScore: 12,
    indicators: ['Login form detected on page'],
    summary:
      'This page showed only low-confidence risk indicators during the latest scan.',
    explanation:
      'The page appears to be a normal enterprise workspace with a standard login prompt.',
    aiExplanation:
      'BrowseShield AI review: no serious issues were detected, though users should always verify the domain before signing in.',
    recommendations: [
      'Continue carefully and re-check the domain before entering sensitive information.',
    ],
    threatType: 'safe',
    userAction: 'trusted_site',
    trustedStatus: true,
    source: 'extension',
    notes: 'Trusted baseline domain.',
    hasLoginForm: true,
    trackerCount: 0,
    scannedAt: '2026-04-18T10:18:00.000Z',
    createdAt: '2026-04-18T10:18:00.000Z',
  },
];
