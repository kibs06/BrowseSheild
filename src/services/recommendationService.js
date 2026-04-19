export function buildRecommendations(scan) {
  const recommendations = new Set();

  if (scan.trustedStatus) {
    recommendations.add('This domain is allowlisted, but you should still confirm unusual prompts before entering sensitive data.');
  }

  if (scan.riskLevel === 'Low') {
    recommendations.add('Continue carefully and re-check the domain before entering sensitive information.');
  }

  if (
    ['phishing suspected', 'suspicious login', 'impersonation domain'].includes(
      scan.threatCategory || scan.threatType,
    )
  ) {
    recommendations.add('Avoid entering credentials or payment details on this page.');
    recommendations.add('Verify the domain spelling against the official website before taking action.');
    recommendations.add('Use MFA on the real service in case credentials were exposed.');
  }

  if ((scan.threatCategory || scan.threatType) === 'insecure connection') {
    recommendations.add('Leave the page and return only over HTTPS on a trusted domain.');
  }

  if ((scan.threatCategory || scan.threatType) === 'tracker-heavy') {
    recommendations.add('Limit interaction until you review the site privacy posture and external scripts.');
  }

  if ((scan.threatCategory || scan.threatType) === 'excessive redirects') {
    recommendations.add('Open the destination manually from a trusted bookmark instead of following redirect chains.');
  }

  if ((scan.threatCategory || scan.threatType) === 'deceptive wording') {
    recommendations.add('Be cautious of urgent language designed to pressure a quick decision.');
  }

  if (scan.riskLevel === 'High' || scan.riskLevel === 'Critical') {
    recommendations.add('Leave the page immediately if it is unexpected or requesting urgent action.');
  }

  if (recommendations.size === 0) {
    recommendations.add('Monitor the page for additional suspicious behavior before trusting it.');
  }

  return [...recommendations];
}
