function getBadgePresentation(scan) {
  const riskLevel = String(scan?.riskLevel || '').toLowerCase();

  if (riskLevel === 'medium' || riskLevel === 'suspicious') {
    return {
      text: '!',
      backgroundColor: '#f59e0b',
      title: `BrowseShield: ${scan.riskLevel} risk detected`,
    };
  }

  if (riskLevel === 'high' || riskLevel === 'critical' || riskLevel === 'danger') {
    return {
      text: '!!',
      backgroundColor: '#ef4444',
      title: `BrowseShield: ${scan.riskLevel} risk detected`,
    };
  }

  return {
    text: '',
    backgroundColor: [0, 0, 0, 0],
    title: `BrowseShield: ${scan?.riskLevel || 'Low'} risk`,
  };
}

export async function updateBadgeForScan(tabId, scan) {
  if (!tabId) {
    return;
  }

  const { text, backgroundColor, title } = getBadgePresentation(scan);
  await chrome.action.setBadgeText({ tabId, text });
  await chrome.action.setBadgeBackgroundColor({ tabId, color: backgroundColor });
  await chrome.action.setTitle({
    tabId,
    title: scan?.url
      ? `${title}\n${scan.url}`
      : title,
  });
}

export async function clearBadgeForTab(tabId) {
  if (!tabId) {
    return;
  }

  await chrome.action.setBadgeText({ tabId, text: '' });
  await chrome.action.setBadgeBackgroundColor({ tabId, color: [0, 0, 0, 0] });
  await chrome.action.setTitle({
    tabId,
    title: 'BrowseShield',
  });
}

export async function clearBadgesForTabs(tabIds = []) {
  await Promise.all(tabIds.filter(Boolean).map((tabId) => clearBadgeForTab(tabId)));
}
