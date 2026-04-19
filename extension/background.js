import {
  buildThreatDetailsUrl,
  DASHBOARD_URL,
  getIgnoredAutoScanHosts,
  isProductionAppUrlConfigured,
} from './config.js';
import { applyTrustedSiteAdjustment, detectPageThreat } from './utils/detection.js';
import { normalizeScanUrl, SCAN_COOLDOWN_MS, shouldScanPage } from './utils/shouldScanPage.js';
import {
  addTrustedSite,
  findTrustedSite,
  persistScanResult,
  recordScanAction,
  updateScanResult,
} from './utils/supabase.js';
import {
  getProtectionEnabled,
  initializeProtectionState,
  setProtectionEnabled,
  shouldRunProtection,
} from './utils/protectionState.js';
import {
  clearBadgeForTab,
  clearBadgesForTabs,
  updateBadgeForScan,
} from './utils/badgeState.js';

const DEBUG_SCAN_LOGS = false;
const ignoredAutoScanHosts = getIgnoredAutoScanHosts();
const scanStateByTab = new Map();
const trustedSiteCache = new Map();
const pendingAutoScans = new Map();
const AUTO_SCAN_DELAY_MS = 650;

function extractErrorMessage(error, fallback) {
  const message = typeof error?.message === 'string' ? error.message.trim() : '';
  if (!message) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(message);
    return parsed.message || parsed.details || parsed.hint || fallback;
  } catch {
    return message;
  }
}

function createIgnorableScanError(message) {
  const error = new Error(message);
  error.code = 'IGNORABLE_SCAN_TARGET';
  return error;
}

function isIgnorableScanError(error) {
  if (error?.code === 'IGNORABLE_SCAN_TARGET') {
    return true;
  }

  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('showing error page') ||
    message.includes('cannot access contents of url') ||
    message.includes('cannot access contents of the page') ||
    message.includes('the tab was closed') ||
    message.includes('no tab with id')
  );
}

async function syncScanAction(scanId, actionType, { pageUrl = '', updateUserAction = true } = {}) {
  if (!scanId) {
    return {
      ok: false,
      skipped: true,
      reason: 'This scan is only stored locally, so the action could not be synced to Supabase.',
    };
  }

  try {
    return await recordScanAction({
      scanId,
      actionType,
      pageUrl,
      source: 'extension',
      updateUserAction,
    });
  } catch (error) {
    return {
      ok: false,
      error: extractErrorMessage(error, 'Unable to sync the action to Supabase.'),
    };
  }
}

async function syncScanUpdate(scanId, updates, fallbackMessage = 'Unable to sync the scan update to Supabase.') {
  if (!scanId) {
    return {
      ok: false,
      skipped: true,
      reason: 'This scan is only stored locally, so the scan update could not be synced to Supabase.',
    };
  }

  try {
    return await updateScanResult(scanId, updates);
  } catch (error) {
    return {
      ok: false,
      error: extractErrorMessage(error, fallbackMessage),
    };
  }
}

function buildActionNotice(successMessage, syncResult) {
  if (!syncResult || syncResult.ok) {
    return successMessage;
  }

  if (syncResult.reason) {
    return `${successMessage} ${syncResult.reason}`;
  }

  if (syncResult.error) {
    return `${successMessage} Supabase sync issue: ${syncResult.error}`;
  }

  return successMessage;
}

function extractHostname(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function clearPendingAutoScans() {
  pendingAutoScans.forEach((timerId) => clearTimeout(timerId));
  pendingAutoScans.clear();
}

async function hideProtectionUiAcrossTabs() {
  const tabs = await chrome.tabs.query({});
  await Promise.all(
    tabs
      .filter((tab) => tab.id && isScannableUrl(tab.url || ''))
      .map((tab) =>
        sendOverlayMessage(tab.id, { view: 'hide' }).catch(() => null),
      ),
  );

  await clearBadgesForTabs(tabs.map((tab) => tab.id)).catch(() => null);
}

async function updateProtectionState(enabled) {
  const nextState = await setProtectionEnabled(enabled);

  if (!nextState) {
    clearPendingAutoScans();
    await hideProtectionUiAcrossTabs().catch(() => null);
  } else {
    scanCurrentActiveTab('protection_resumed');
  }

  return nextState;
}

function isScannableUrl(url = '') {
  return /^https?:\/\//i.test(url);
}

function shouldIgnoreAutoScanUrl(url = '') {
  if (!isScannableUrl(url)) {
    return true;
  }

  try {
    const parsed = new URL(url);
    return ignoredAutoScanHosts.has(parsed.hostname.toLowerCase());
  } catch {
    return true;
  }
}

function ensureAppUrlReady() {
  if (!isProductionAppUrlConfigured() && !DASHBOARD_URL.startsWith('http://localhost:5173')) {
    throw new Error('Set the production BrowseShield app URL in extension/config.js before packaging the extension.');
  }
}

function debugScanLog(message, details = undefined) {
  if (!DEBUG_SCAN_LOGS) {
    return;
  }

  if (details === undefined) {
    console.info(`[BrowseShield] ${message}`);
    return;
  }

  console.info(`[BrowseShield] ${message}`, details);
}

function createTabScanState(scan) {
  const lastScannedAt =
    (typeof scan?.lastScannedAt === 'number' && scan.lastScannedAt) ||
    (typeof scan?.lastScannedAtMs === 'number' && scan.lastScannedAtMs) ||
    (scan?.scannedAt ? Date.parse(scan.scannedAt) : 0) ||
    Date.now();

  return {
    tabId: scan?.currentTabId ?? null,
    url: scan?.url || '',
    lastScannedAt,
    lastRiskLevel: scan?.riskLevel || 'Unknown',
    notificationShown: Boolean(scan?.notificationShown),
    pageSessionKey: scan?.pageSessionKey || normalizeScanUrl(scan?.url || ''),
    scanId: scan?.recordId || null,
  };
}

function cacheTrustedSite(domain, trustedSite) {
  if (!domain) {
    return;
  }

  trustedSiteCache.set(domain, trustedSite || null);
}

async function getTrustedSiteForDomain(domain) {
  if (!domain) {
    return null;
  }

  if (trustedSiteCache.has(domain)) {
    return trustedSiteCache.get(domain);
  }

  const trustedSite = await findTrustedSite(domain).catch(() => null);
  cacheTrustedSite(domain, trustedSite);
  return trustedSite;
}

function getOverlayViewForRisk(scan) {
  if (scan?.riskLevel === 'Low' || scan?.riskLevel === 'Safe') {
    return 'safe';
  }

  if (scan?.riskLevel === 'Medium' || scan?.riskLevel === 'Suspicious') {
    return 'suspicious';
  }

  return 'danger';
}

function shouldDisplayOverlayForScan(scan, trigger = 'manual') {
  const overlayView = getOverlayViewForRisk(scan);

  if (overlayView === 'danger') {
    return true;
  }

  if (overlayView === 'suspicious') {
    return trigger === 'manual';
  }

  return false;
}

async function sendOverlayMessage(tabId, payload) {
  if (!tabId) {
    return {
      ok: false,
      skipped: true,
      reason: 'No tab was available for the overlay update.',
    };
  }

  try {
    return (
      (await chrome.tabs.sendMessage(tabId, {
        type: 'BROWSERSHIELD_OVERLAY',
        ...payload,
      })) || { ok: true }
    );
  } catch (error) {
    if (isIgnorableScanError(error)) {
      return {
        ok: false,
        skipped: true,
        reason: 'Skipped overlay update for an inaccessible or browser-generated page.',
      };
    }

    throw error;
  }
}

async function showScanningOverlay(tab) {
  if (!tab?.id || shouldIgnoreAutoScanUrl(tab.url) || !(await shouldRunProtection())) {
    return;
  }

  await sendOverlayMessage(tab.id, {
    view: 'scanning',
    url: tab.url,
  }).catch(() => null);
}

async function showResultOverlay(tabId, scan, { trigger = 'manual' } = {}) {
  if (!(await shouldRunProtection())) {
    return;
  }

  if (!shouldDisplayOverlayForScan(scan, trigger)) {
    await sendOverlayMessage(tabId, { view: 'hide' }).catch(() => null);
    return;
  }

  await sendOverlayMessage(tabId, {
    view: getOverlayViewForRisk(scan),
    scan,
  }).catch(() => null);
}

function getLifecycleActionTypes(scan, { trigger = 'manual' } = {}) {
  const actionTypes = ['scanned'];
  const overlayView = getOverlayViewForRisk(scan);

  if (overlayView === 'suspicious' && trigger === 'manual') {
    actionTypes.push('suspicious_notified');
  } else {
    if (overlayView === 'danger') {
      actionTypes.push('danger_blocked');
    }
  }

  return actionTypes;
}

async function syncLifecycleActions(scan, options = {}) {
  if (!scan?.recordId) {
    return;
  }

  for (const actionType of getLifecycleActionTypes(scan, options)) {
    await syncScanAction(scan.recordId, actionType, {
      pageUrl: scan.url,
      updateUserAction: false,
    }).catch(() => null);
  }
}

async function collectPageContext(tabId) {
  try {
    return await chrome.tabs.sendMessage(tabId, { type: 'COLLECT_PAGE_CONTEXT' });
  } catch (error) {
    if (isIgnorableScanError(error)) {
      throw createIgnorableScanError('Skipped scan because the tab is showing a browser error page.');
    }

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const forms = [...document.forms];
          const loginFormCount = forms.filter((form) => {
            const passwordInput = form.querySelector('input[type="password"]');
            if (passwordInput) {
              return true;
            }

            const emailInput = form.querySelector('input[type="email"], input[name*="user"], input[name*="login"]');
            return Boolean(emailInput);
          }).length;

          const assetSources = [
            ...[...document.scripts].map((script) => script.src || ''),
            ...[...document.querySelectorAll('iframe')].map((frame) => frame.src || ''),
            ...[...document.images].map((image) => image.src || ''),
          ].join(' ');

          const trackerKeywords = ['analytics', 'pixel', 'tracker', 'beacon', 'ads', 'tagmanager', 'doubleclick', 'facebook'];
          const trackerMatches = trackerKeywords.filter((keyword) => assetSources.toLowerCase().includes(keyword));
          const navigationEntry = performance.getEntriesByType('navigation')[0];
          const favicon =
            document.querySelector('link[rel~="icon"]')?.href ||
            document.querySelector('link[rel="shortcut icon"]')?.href ||
            '';

          return {
            title: document.title || 'Untitled page',
            textContent: (document.body?.innerText || '').slice(0, 4000),
            hasLoginForm: loginFormCount > 0,
            trackerCount: trackerMatches.length + [...document.querySelectorAll('iframe[src], script[src]')].length,
            trackerMatches,
            redirectCount: Number(navigationEntry?.redirectCount ?? 0),
            faviconUrl: favicon,
            pageFingerprint: [
              location.hostname,
              document.title || 'untitled',
              loginFormCount > 0 ? 'login' : 'no-login',
              trackerMatches.length,
            ].join('|'),
          };
        },
      });

      return results[0]?.result ?? {
        title: 'Untitled page',
        textContent: '',
        hasLoginForm: false,
        trackerCount: 0,
        trackerMatches: [],
        redirectCount: 0,
        faviconUrl: '',
        pageFingerprint: '',
      };
    } catch (error) {
      if (isIgnorableScanError(error)) {
        throw createIgnorableScanError('Skipped scan because the tab is showing a browser error page.');
      }

      throw error;
    }
  }
}

async function saveLastScan(scan) {
  const currentTabId = scan?.currentTabId;
  const lastScansByTab = await getLastScansByTab();

  if (currentTabId != null) {
    lastScansByTab[currentTabId] = scan;
    scanStateByTab.set(currentTabId, createTabScanState(scan));
  }

  await chrome.storage.local.set({
    lastScan: scan,
    lastScansByTab,
  });
}

async function getLastScan() {
  const { lastScan } = await chrome.storage.local.get(['lastScan']);
  return lastScan || null;
}

async function getLastScansByTab() {
  const { lastScansByTab } = await chrome.storage.local.get(['lastScansByTab']);
  return lastScansByTab || {};
}

async function getSavedScanForTab(tabId) {
  if (tabId == null) {
    return null;
  }

  const lastScansByTab = await getLastScansByTab();
  return lastScansByTab?.[tabId] || null;
}

async function getScanForTab(tabId) {
  if (tabId == null) {
    return getLastScan();
  }

  return (await getSavedScanForTab(tabId)) || (await getLastScan());
}

async function getScanStateForTab(tabId) {
  if (tabId == null) {
    return null;
  }

  if (scanStateByTab.has(tabId)) {
    return scanStateByTab.get(tabId);
  }

  const savedScan = await getSavedScanForTab(tabId);
  if (!savedScan) {
    return null;
  }

  const state = createTabScanState(savedScan);
  scanStateByTab.set(tabId, state);
  return state;
}

function buildReportUrl(scan) {
  return scan?.recordId ? buildThreatDetailsUrl(scan.recordId) : DASHBOARD_URL;
}

async function scanTab(tab, { notify = false, trigger = 'manual', force = false, manualRescan = false } = {}) {
  if (!tab?.id || !tab.url) {
    throw new Error('No active tab was available for scanning.');
  }

  if (!isScannableUrl(tab.url)) {
    throw new Error('This page cannot be scanned because browser-internal pages are restricted.');
  }

  const domain = extractHostname(tab.url);
  const trustedSite = await getTrustedSiteForDomain(domain);
  if (trustedSite && trigger !== 'manual' && !manualRescan && !force) {
    debugScanLog('Skipping automatic scan: trusted site', {
      tabId: tab.id,
      url: tab.url,
      domain,
    });

    return {
      ok: true,
      skipped: true,
      reason: 'trusted_site_skip',
      trustedSite,
      scan: await getSavedScanForTab(tab.id),
    };
  }

  const cacheEntry = await getScanStateForTab(tab.id);
  const decision = shouldScanPage({
    url: tab.url,
    now: Date.now(),
    cacheEntry,
    cooldownMs: SCAN_COOLDOWN_MS,
    manualRescan: force || manualRescan,
  });

  if (trigger !== 'manual' && !decision.shouldScan) {
    debugScanLog(`Skipping scan: ${decision.reason}`, {
      tabId: tab.id,
      url: tab.url,
      cooldownRemainingMs: decision.remainingMs ?? 0,
    });

    return {
      ok: true,
      skipped: true,
      reason: decision.reason,
      scan: await getSavedScanForTab(tab.id),
    };
  }

  if (notify && trigger === 'manual') {
    await showScanningOverlay(tab);
  }

  debugScanLog(
    trigger === 'manual'
      ? 'Manual rescan triggered'
      : decision.reason === 'expired_rescan'
        ? 'Rescanning: cooldown expired'
        : 'Scanning new page',
    {
      tabId: tab.id,
      url: tab.url,
      reason: decision.reason,
    },
  );

  const pageContext = await collectPageContext(tab.id);

  let scan = detectPageThreat({
    url: tab.url,
    title: pageContext.title || tab.title || 'Untitled page',
    textContent: pageContext.textContent || '',
    hasLoginForm: pageContext.hasLoginForm,
    trackerCount: pageContext.trackerCount,
    trackerMatches: pageContext.trackerMatches,
    redirectCount: pageContext.redirectCount,
    faviconUrl: pageContext.faviconUrl,
    pageFingerprint: pageContext.pageFingerprint,
  });

  if (trustedSite) {
    scan = applyTrustedSiteAdjustment(scan, trustedSite);
  }

  let persistence;
  try {
    persistence = await persistScanResult(scan);
  } catch (error) {
    persistence = {
      ok: false,
      error: error.message || 'Unable to reach Supabase.',
    };
  }

  if (persistence?.ok) {
    console.info('BrowseShield scan persisted to Supabase.', {
      url: scan.url,
      recordId: persistence.id,
    });
  } else if (persistence?.reason || persistence?.error) {
    console.warn('BrowseShield scan did not persist to Supabase.', {
      url: scan.url,
      reason: persistence.reason || persistence.error,
    });
  }

  const overlayShown = shouldDisplayOverlayForScan(scan, trigger);
  const storedScan = {
    ...scan,
    currentTabId: tab.id,
    lastScannedAt: Date.now(),
    notificationShown: overlayShown,
    pageSessionKey: decision.normalizedUrl || normalizeScanUrl(tab.url),
    trustedSite: trustedSite || null,
    persisted: persistence.ok,
    persistenceReason: persistence.reason || persistence.error || '',
    recordId: persistence.id || null,
  };

  await updateBadgeForScan(tab.id, storedScan).catch(() => null);

  if (persistence.ok) {
    await syncLifecycleActions(storedScan, { trigger });
  }

  await saveLastScan(storedScan);

  if (notify) {
    await showResultOverlay(tab.id, storedScan, { trigger });
  }

  return {
    ok: true,
    scan: storedScan,
    persistence,
  };
}

async function scanActiveTab() {
  const protectionEnabled = await getProtectionEnabled();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return scanTab(tab, {
    notify: protectionEnabled,
    trigger: 'manual',
    force: true,
    manualRescan: true,
  });
}

async function runAutomaticScanForTab(tab) {
  if (!tab?.active || shouldIgnoreAutoScanUrl(tab.url) || !(await shouldRunProtection())) {
    return;
  }

  try {
    await scanTab(tab, {
      notify: true,
      trigger: 'automatic',
    });
  } catch (error) {
    if (!isIgnorableScanError(error)) {
      console.error('BrowseShield automatic scan failed:', error);
    }
  }
}

async function queueAutomaticScan(tabId, reason = 'event') {
  if (!tabId) {
    return;
  }

  if (!(await shouldRunProtection())) {
    return;
  }

  const existingTimer = pendingAutoScans.get(tabId);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const timerId = setTimeout(async () => {
    pendingAutoScans.delete(tabId);

    try {
      if (!(await shouldRunProtection())) {
        return;
      }

      const tab = await chrome.tabs.get(tabId);
      if (!tab?.active || tab.status !== 'complete') {
        return;
      }

      debugScanLog('Queued automatic scan fired', {
        tabId,
        url: tab.url,
        reason,
      });

      await runAutomaticScanForTab(tab);
    } catch (error) {
      if (!isIgnorableScanError(error)) {
        console.error('BrowseShield queued automatic scan failed:', error);
      }
    }
  }, AUTO_SCAN_DELAY_MS);

  pendingAutoScans.set(tabId, timerId);
}

async function scanCurrentActiveTab(reason = 'startup') {
  try {
    if (!(await shouldRunProtection())) {
      return;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      return;
    }

    queueAutomaticScan(tab.id, reason);
  } catch (error) {
    console.error('BrowseShield active-tab auto scan bootstrap failed:', error);
  }
}

async function handleTrustSite(tabId) {
  const lastScan = await getScanForTab(tabId);
  if (!lastScan) {
    throw new Error('Run a scan before trusting the current site.');
  }

  const domain = lastScan.rootDomain || lastScan.hostname || extractHostname(lastScan.url);
  if (!domain) {
    throw new Error('No domain was available to trust for this scan.');
  }

  let trustedSite = { domain };
  const trustedResult = await addTrustedSite({
    domain,
    reason: 'Trusted from BrowseShield extension',
    source: 'extension',
  }).catch((error) => {
    throw new Error(extractErrorMessage(error, 'Unable to save the trusted site to Supabase.'));
  });

  if (!trustedResult?.ok || !trustedResult.trustedSite) {
    throw new Error(trustedResult?.reason || 'Unable to save the trusted site to Supabase.');
  }

  trustedSite = trustedResult.trustedSite;
  cacheTrustedSite(domain, trustedSite);

  const actionSyncResult = await syncScanAction(lastScan.recordId, 'trusted_site', {
    pageUrl: lastScan.url,
  });
  const scanUpdateResult = await syncScanUpdate(
    lastScan.recordId,
    {
      trusted_status: true,
      user_action: 'trusted_site',
    },
    'Unable to mark this scan as trusted in Supabase.',
  );

  const updated = {
    ...lastScan,
    trustedStatus: true,
    trustedSite,
    userAction: 'trusted_site',
  };
  await saveLastScan(updated);
  return {
    ok: true,
    scan: updated,
    notice: buildActionNotice(
      buildActionNotice(
        'Site marked as trusted and saved to Supabase.',
        actionSyncResult,
      ),
      scanUpdateResult,
    ),
  };
}

async function handleContinueAnyway(tabId) {
  const lastScan = await getScanForTab(tabId);
  if (!lastScan) {
    throw new Error('Run a scan before recording a continuation action.');
  }

  const actionSyncResult = await syncScanAction(lastScan.recordId, 'continued_anyway', {
    pageUrl: lastScan.url,
  });

  const updated = {
    ...lastScan,
    userAction: 'continued_anyway',
  };
  await saveLastScan(updated);
  return {
    ok: true,
    scan: updated,
    notice: buildActionNotice('Marked this scan as "Continue Anyway".', actionSyncResult),
  };
}

async function handleLeaveSite(tabId) {
  const lastScan = await getScanForTab(tabId);
  if (!lastScan?.currentTabId) {
    throw new Error('No scanned tab is available to leave.');
  }

  const actionSyncResult = await syncScanAction(lastScan.recordId, 'left_site', {
    pageUrl: lastScan.url,
  });
  const updated = {
    ...lastScan,
    userAction: 'left_site',
  };
  await saveLastScan(updated);
  return {
    ok: true,
    scan: updated,
    currentTabId: lastScan.currentTabId,
    leaveUrl: 'about:blank',
    notice: buildActionNotice('Leaving the current site.', actionSyncResult),
  };
}

async function handleViewReport(tabId) {
  const lastScan = await getScanForTab(tabId);
  if (!lastScan) {
    throw new Error('Run a scan before opening a report.');
  }

  const actionSyncResult = await syncScanAction(lastScan.recordId, 'viewed_report', {
    pageUrl: lastScan.url,
  });

  const updated = {
    ...lastScan,
    userAction: 'viewed_report',
  };
  await saveLastScan(updated);
  return {
    ok: true,
    scan: updated,
    reportUrl: buildReportUrl(updated),
    notice: buildActionNotice('Opening the full report.', actionSyncResult),
  };
}

chrome.runtime.onInstalled.addListener(async () => {
  scanStateByTab.clear();
  clearPendingAutoScans();
  await initializeProtectionState();
  await scanCurrentActiveTab('installed');
});

chrome.runtime.onStartup.addListener(() => {
  clearPendingAutoScans();
  initializeProtectionState().then(() => scanCurrentActiveTab('startup'));
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' && !changeInfo.url) {
    return;
  }

  if (changeInfo.url) {
    clearBadgeForTab(tabId).catch(() => null);
  }

  queueAutomaticScan(tabId, changeInfo.status === 'complete' ? 'tab_complete' : 'url_changed');
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  queueAutomaticScan(tabId, 'tab_activated');
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  scanStateByTab.delete(tabId);
  clearBadgeForTab(tabId).catch(() => null);
  const pendingTimer = pendingAutoScans.get(tabId);
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    pendingAutoScans.delete(tabId);
  }
  const existing = await chrome.storage.local.get(['lastScansByTab']);
  const lastScansByTab = existing.lastScansByTab || {};
  if (!(tabId in lastScansByTab)) {
    return;
  }

  delete lastScansByTab[tabId];
  await chrome.storage.local.set({ lastScansByTab });
});

async function handleNavigationAutoScan(tabId) {
  queueAutomaticScan(tabId, 'navigation');
}

chrome.webNavigation.onCommitted.addListener(({ tabId, frameId }) => {
  if (frameId !== 0) {
    return;
  }

  handleNavigationAutoScan(tabId);
});

chrome.webNavigation.onHistoryStateUpdated.addListener(({ tabId, frameId }) => {
  if (frameId !== 0) {
    return;
  }

  handleNavigationAutoScan(tabId);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'RUN_ACTIVE_SCAN') {
    scanActiveTab()
      .then(sendResponse)
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error.message || 'Unable to scan the active tab.',
        }),
      );
    return true;
  }

  if (message?.type === 'OPEN_DASHBOARD') {
    try {
      ensureAppUrlReady();
    } catch (error) {
      sendResponse({ ok: false, error: error.message || 'The BrowseShield app URL is not configured.' });
      return true;
    }

    sendResponse({ ok: true, notice: 'Opening the BrowseShield dashboard.' });
    chrome.tabs
      .create({ url: DASHBOARD_URL })
      .catch((error) => console.error('BrowseShield dashboard open failed:', error));
    return true;
  }

  if (message?.type === 'GET_LAST_SCAN') {
    Promise.all([getLastScan(), getProtectionEnabled()])
      .then(([scan, protectionEnabled]) => sendResponse({ ok: true, scan, protectionEnabled }))
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error.message || 'Unable to load the latest scan.',
        }),
      );
    return true;
  }

  if (message?.type === 'GET_PROTECTION_STATE') {
    getProtectionEnabled()
      .then((protectionEnabled) => sendResponse({ ok: true, protectionEnabled }))
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error.message || 'Unable to load the protection state.',
        }),
      );
    return true;
  }

  if (message?.type === 'SET_PROTECTION_STATE') {
    updateProtectionState(message.enabled)
      .then((protectionEnabled) =>
        sendResponse({
          ok: true,
          protectionEnabled,
          notice: protectionEnabled
            ? 'Shielding Active. Automatic scans and warnings are enabled.'
            : 'Shielding Paused. Automatic scans and warnings are disabled.',
        }),
      )
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error.message || 'Unable to update the protection state.',
        }),
      );
    return true;
  }

  if (message?.type === 'TRUST_SITE') {
    handleTrustSite(sender?.tab?.id)
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: error.message || 'Unable to trust site.' }));
    return true;
  }

  if (message?.type === 'CONTINUE_ANYWAY') {
    handleContinueAnyway(sender?.tab?.id)
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: error.message || 'Unable to record action.' }));
    return true;
  }

  if (message?.type === 'LEAVE_SITE') {
    handleLeaveSite(sender?.tab?.id)
      .then(({ currentTabId, leaveUrl, ...payload }) => {
        sendResponse(payload);
        return chrome.tabs
          .update(currentTabId, { url: leaveUrl })
          .catch((error) => console.error('BrowseShield leave-site action failed:', error));
      })
      .catch((error) => sendResponse({ ok: false, error: error.message || 'Unable to leave site.' }));
    return true;
  }

  if (message?.type === 'VIEW_REPORT') {
    handleViewReport(sender?.tab?.id)
      .then(({ reportUrl, ...payload }) => {
        ensureAppUrlReady();
        sendResponse(payload);
        return chrome.tabs
          .create({ url: reportUrl })
          .catch((error) => console.error('BrowseShield report open failed:', error));
      })
      .catch((error) => sendResponse({ ok: false, error: error.message || 'Unable to open report.' }));
    return true;
  }
});
