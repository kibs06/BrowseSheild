import { buildRecommendations } from './recommendationService';

function buildSeveritySentence(scan) {
  if (scan.trustedStatus) {
    return 'The domain is on your trusted allowlist, so BrowseShield softened the warning while still documenting the findings.';
  }

  if (scan.riskLevel === 'Critical') {
    return 'This is a severe warning and should be treated as an unsafe browsing session.';
  }

  if (scan.riskLevel === 'High') {
    return 'This is a strong warning and should be reviewed before any interaction continues.';
  }

  if (scan.riskLevel === 'Medium') {
    return 'This is a moderate warning and users should verify the site before trusting it.';
  }

  return 'This appears to be a lower-risk session, but some caution is still appropriate.';
}

function buildConfidenceSentence(scan) {
  const signalCount = scan.indicators?.length ?? 0;
  if (signalCount >= 5) {
    return 'Confidence is elevated because multiple independent indicators aligned in the same direction.';
  }

  if (signalCount >= 3) {
    return 'Confidence is moderate because several signals pointed to the same concern.';
  }

  return 'Confidence is limited because only a small number of indicators were present.';
}

export async function generateAiExplanation(scan) {
  const topSignals = (scan.indicators ?? []).slice(0, 3);
  const category = scan.threatCategory || scan.threatType || 'suspicious activity';
  const recommendations =
    scan.recommendations?.length ? scan.recommendations : buildRecommendations(scan);

  const narrative = [
    `BrowseShield assessed this page as ${scan.riskLevel.toLowerCase()} risk with a score of ${scan.riskScore}/100.`,
    category === 'safe'
      ? 'The page did not match any major threat category during this scan.'
      : `The strongest matching threat category was ${category}.`,
    topSignals.length
      ? `Key signals included ${topSignals.join(', ').toLowerCase()}.`
      : 'No major warning signals were captured in the latest scan.',
    buildSeveritySentence(scan),
    buildConfidenceSentence(scan),
  ].join(' ');

  return Promise.resolve({
    mode: 'deterministic',
    text: narrative,
    threatNarrative: narrative,
    confidenceSummary: buildConfidenceSentence(scan),
    recommendations,
  });
}
