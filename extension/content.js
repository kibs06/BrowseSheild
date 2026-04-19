function collectPageContext() {
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
}

const overlayController =
  globalThis.BrowseShieldOverlay?.createOverlayController({
    onAction: handleOverlayAction,
  }) ?? null;

function sendRuntimeMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({
          ok: false,
          error: chrome.runtime.lastError.message || 'BrowseShield could not complete that action.',
        });
        return;
      }

      resolve(response || { ok: false, error: 'BrowseShield did not return a response.' });
    });
  });
}

function showActionSuccess(actionId, response) {
  if (!overlayController) {
    return;
  }

  if (actionId === 'trust_site') {
    overlayController.showSafe({
      scan: response.scan,
      titleText: 'Trusted site saved',
      bodyText: response.notice || 'This site has been added to your trusted list.',
    });
    return;
  }

  if (actionId === 'continue' || actionId === 'continue_anyway') {
    overlayController.hideDanger();
    overlayController.showActionFeedback({
      tone: 'suspicious',
      titleText: 'Continuing with caution',
      bodyText: response.notice || 'BrowseShield recorded that you continued anyway.',
      scan: response.scan,
    });
    return;
  }

  if (actionId === 'view_report') {
    overlayController.showActionFeedback({
      tone: 'scanning',
      titleText: 'Opening full report',
      bodyText: response.notice || 'BrowseShield is opening the detailed report view.',
      scan: response.scan,
    });
    return;
  }

  if (actionId === 'leave_site') {
    overlayController.showActionFeedback({
      tone: 'danger',
      titleText: 'Leaving site',
      bodyText: response.notice || 'BrowseShield is navigating away from this page.',
      scan: response.scan,
    });
  }
}

async function handleOverlayAction(actionId) {
  if (!overlayController) {
    return;
  }

  const messageType = {
    continue: 'CONTINUE_ANYWAY',
    continue_anyway: 'CONTINUE_ANYWAY',
    leave_site: 'LEAVE_SITE',
    trust_site: 'TRUST_SITE',
    view_report: 'VIEW_REPORT',
  }[actionId];

  if (!messageType) {
    return;
  }

  overlayController.setActionPending(actionId, true);

  try {
    const response = await sendRuntimeMessage({ type: messageType });
    if (!response?.ok) {
      throw new Error(response?.error || 'BrowseShield could not complete that action.');
    }

    showActionSuccess(actionId, response);
  } catch (error) {
    overlayController.showActionFeedback({
      tone: 'danger',
      titleText: 'Action failed',
      bodyText: error.message || 'BrowseShield could not complete that action.',
      scan: {
        url: location.href,
      },
      autoHideMs: 5200,
    });
  } finally {
    overlayController.setActionPending(actionId, false);
  }
}

function handleOverlayMessage(message) {
  if (!overlayController) {
    return { ok: false, error: 'Overlay controller is unavailable on this page.' };
  }

  switch (message?.view) {
    case 'scanning':
      overlayController.showScanning({ url: message.url || location.href });
      return { ok: true };
    case 'safe':
      overlayController.showSafe({ scan: message.scan });
      return { ok: true };
    case 'suspicious':
      overlayController.showSuspicious({ scan: message.scan });
      return { ok: true };
    case 'danger':
      overlayController.showDanger({ scan: message.scan });
      return { ok: true };
    case 'result':
      overlayController.showResult({ scan: message.scan });
      return { ok: true };
    case 'feedback':
      overlayController.showActionFeedback({
        tone: message.tone,
        titleText: message.titleText,
        bodyText: message.bodyText,
        scan: message.scan,
        autoHideMs: message.autoHideMs,
      });
      return { ok: true };
    case 'hide':
      overlayController.hideAll();
      return { ok: true };
    default:
      return { ok: false, error: 'Unknown overlay command.' };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'COLLECT_PAGE_CONTEXT') {
    sendResponse(collectPageContext());
    return;
  }

  if (message?.type === 'BROWSERSHIELD_OVERLAY') {
    sendResponse(handleOverlayMessage(message));
  }
});
