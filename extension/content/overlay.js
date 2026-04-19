(() => {
  const SAFE_AUTO_HIDE_MS = 3200;
  const FEEDBACK_AUTO_HIDE_MS = 3600;
  const SUSPICIOUS_AUTO_HIDE_MS = 14000;

  function createElement(tagName, className, textContent = '') {
    const element = document.createElement(tagName);
    if (className) {
      element.className = className;
    }

    if (textContent) {
      element.textContent = textContent;
    }

    return element;
  }

  function truncateIndicators(indicators = [], limit = 3) {
    return Array.isArray(indicators) ? indicators.filter(Boolean).slice(0, limit) : [];
  }

  function actionLabel(actionId) {
    return {
      continue: 'Continue',
      continue_anyway: 'Continue Anyway',
      leave_site: 'Leave Site',
      trust_site: 'Trust Site',
      view_report: 'View Report',
    }[actionId] ?? 'Action';
  }

  function createActionButton(label, actionId, variant = 'secondary') {
    const button = createElement('button', 'browseshield-button', label);
    button.type = 'button';
    button.dataset.actionId = actionId;
    button.dataset.variant = variant;
    return button;
  }

  function getSiteLabel(scan = {}) {
    return scan.rootDomain || scan.hostname || scan.url || location.href;
  }

  function getToneFromScan(scan = {}) {
    if (scan.riskLevel === 'Low' || scan.riskLevel === 'Safe') {
      return 'safe';
    }

    if (scan.riskLevel === 'Medium' || scan.riskLevel === 'Suspicious') {
      return 'suspicious';
    }

    return 'danger';
  }

  function createOverlayController({ onAction } = {}) {
    const root = createElement('div');
    root.id = 'browseshield-overlay-root';

    const toastLayer = createElement('div', 'browseshield-toast-layer');
    const toast = createElement('section', 'browseshield-toast is-hidden');
    const header = createElement('div', 'browseshield-toast-header');
    const eyebrow = createElement('span', 'browseshield-eyebrow', 'Live protection');
    const pill = createElement('span', 'browseshield-pill', 'Scanning');
    const status = createElement('div', 'browseshield-toast-status');
    const iconSlot = createElement('div', 'browseshield-toast-icon-slot');
    const copyStack = createElement('div', 'browseshield-toast-copy');
    const title = createElement('h2', 'browseshield-toast-title', 'Scanning this site...');
    const body = createElement('p', 'browseshield-toast-body', 'BrowseShield is checking this page for live risk signals.');
    const meta = createElement('div', 'browseshield-toast-meta');
    const site = createElement('div', 'browseshield-toast-site');
    const siteLabel = createElement('span', 'browseshield-toast-site-label', 'Current site');
    const siteValue = createElement('strong', 'browseshield-toast-site-value', location.hostname || location.href);
    const score = createElement('div', 'browseshield-score');
    const scoreValue = createElement('strong', '', '--');
    const scoreLabel = createElement('span', '', 'Risk');
    const indicators = createElement('ul', 'browseshield-indicator-list');
    const actions = createElement('div', 'browseshield-toast-actions');

    let hideTimer = null;
    let currentButtons = [];

    const dangerModal =
      globalThis.BrowseShieldDangerModal?.createDangerModal({
        onAction: (actionId) => {
          if (typeof onAction === 'function') {
            onAction(actionId, { surface: 'danger', controller });
          }
        },
      }) ?? null;

    score.append(scoreValue, scoreLabel);
    site.append(siteLabel, siteValue);
    meta.append(site, score);
    copyStack.append(title, body);
    status.append(iconSlot, copyStack);
    header.append(eyebrow, pill);
    toast.append(header, status, meta, indicators, actions);
    toastLayer.append(toast);
    root.append(toastLayer);

    if (dangerModal?.element) {
      root.append(dangerModal.element);
    }

    const mount = () => {
      if (!document.documentElement.contains(root)) {
        document.documentElement.append(root);
      }
    };

    mount();

    function clearHideTimer() {
      if (hideTimer) {
        window.clearTimeout(hideTimer);
        hideTimer = null;
      }
    }

    function scheduleHide(delayMs) {
      clearHideTimer();
      hideTimer = window.setTimeout(() => {
        hideToast();
      }, delayMs);
    }

    function setIcon(tone) {
      iconSlot.innerHTML = '';

      if (tone === 'scanning') {
        const pulse = createElement('div', 'browseshield-scanner-pulse');
        iconSlot.append(pulse);
        return;
      }

      if (tone === 'safe') {
        const check = createElement('div', 'browseshield-safe-check', 'OK');
        iconSlot.append(check);
        return;
      }

      const threatChip = createElement('div', 'browseshield-status-chip');
      threatChip.dataset.tone = tone;
      threatChip.textContent = tone === 'suspicious' ? '!' : '!!';
      iconSlot.append(threatChip);
    }

    function renderIndicators(indicatorItems = []) {
      indicators.innerHTML = '';
      const visibleIndicators = truncateIndicators(indicatorItems);
      if (!visibleIndicators.length) {
        indicators.hidden = true;
        return;
      }

      indicators.hidden = false;
      visibleIndicators.forEach((indicator) => {
        indicators.append(createElement('li', '', indicator));
      });
    }

    function renderButtons(buttonItems = []) {
      actions.innerHTML = '';
      currentButtons = [];

      if (!buttonItems.length) {
        actions.hidden = true;
        return;
      }

      actions.hidden = false;
      buttonItems.forEach((buttonConfig) => {
        const button = createActionButton(buttonConfig.label, buttonConfig.actionId, buttonConfig.variant);
        button.addEventListener('click', () => {
          if (typeof onAction === 'function' && !button.disabled) {
            onAction(buttonConfig.actionId, { surface: 'toast', controller });
          }
        });
        currentButtons.push(button);
        actions.append(button);
      });
    }

    function applyToastState({
      tone,
      eyebrowText,
      pillText,
      titleText,
      bodyText,
      scan,
      indicatorItems = [],
      buttonItems = [],
      autoHideMs = null,
    }) {
      mount();
      clearHideTimer();
      hideDanger();
      toast.dataset.tone = tone;
      eyebrow.textContent = eyebrowText;
      pill.textContent = pillText;
      title.textContent = titleText;
      body.textContent = bodyText;
      siteValue.textContent = getSiteLabel(scan);
      scoreValue.textContent = scan?.riskScore != null ? String(scan.riskScore) : '--';
      setIcon(tone);
      renderIndicators(indicatorItems);
      renderButtons(buttonItems);
      toast.classList.remove('is-hidden');
      requestAnimationFrame(() => {
        toast.classList.add('is-visible');
      });

      if (autoHideMs) {
        scheduleHide(autoHideMs);
      }
    }

    function hideToast() {
      clearHideTimer();
      toast.classList.remove('is-visible');
      toast.classList.add('is-hidden');
      currentButtons.forEach((button) => {
        button.disabled = false;
        button.textContent = actionLabel(button.dataset.actionId);
      });
    }

    function hideDanger() {
      dangerModal?.hide();
    }

    function hideAll() {
      hideToast();
      hideDanger();
    }

    function showScanning({ url } = {}) {
      applyToastState({
        tone: 'scanning',
        eyebrowText: 'Realtime scan',
        pillText: 'Scanning',
        titleText: 'Scanning this site...',
        bodyText: 'BrowseShield is reviewing the page before you continue.',
        scan: {
          url: url || location.href,
        },
      });
    }

    function showSafe({ scan, titleText, bodyText } = {}) {
      const resolvedScan = scan || {};
      applyToastState({
        tone: 'safe',
        eyebrowText: 'Site cleared',
        pillText: 'Safe',
        titleText: titleText || 'This site appears safe',
        bodyText:
          bodyText ||
          resolvedScan.summary ||
          'BrowseShield found only low-confidence indicators during this visit.',
        scan: resolvedScan,
        indicatorItems: truncateIndicators(resolvedScan.indicators, 2),
        autoHideMs: SAFE_AUTO_HIDE_MS,
      });
    }

    function showSuspicious({ scan } = {}) {
      const resolvedScan = scan || {};
      applyToastState({
        tone: 'suspicious',
        eyebrowText: 'Warning issued',
        pillText: `${resolvedScan.riskLevel || 'Medium'} Risk`,
        titleText: 'Suspicious activity detected',
        bodyText:
          resolvedScan.summary ||
          resolvedScan.warningMessage ||
          'BrowseShield found signals that deserve a closer look before you continue.',
        scan: resolvedScan,
        indicatorItems:
          resolvedScan.indicators?.length
            ? resolvedScan.indicators
            : ['Suspicious browsing indicators were detected on this page.'],
        buttonItems: [
          { label: 'View Report', actionId: 'view_report', variant: 'primary' },
          { label: 'Continue', actionId: 'continue', variant: 'warning' },
          { label: 'Trust Site', actionId: 'trust_site', variant: 'secondary' },
        ],
        autoHideMs: SUSPICIOUS_AUTO_HIDE_MS,
      });
    }

    function showDanger({ scan } = {}) {
      hideToast();
      mount();
      dangerModal?.show({ scan: scan || {} });
    }

    function showActionFeedback({
      tone = 'scanning',
      titleText = 'Action completed',
      bodyText = 'BrowseShield updated the current session.',
      scan,
      autoHideMs = FEEDBACK_AUTO_HIDE_MS,
    } = {}) {
      applyToastState({
        tone,
        eyebrowText: 'Response action',
        pillText: tone === 'safe' ? 'Updated' : tone === 'suspicious' ? 'Warning' : 'Status',
        titleText,
        bodyText,
        scan: scan || {},
        autoHideMs,
      });
    }

    function showResult({ scan } = {}) {
      const tone = getToneFromScan(scan);
      if (tone === 'safe') {
        showSafe({ scan });
        return;
      }

      if (tone === 'suspicious') {
        showSuspicious({ scan });
        return;
      }

      showDanger({ scan });
    }

    function setActionPending(actionId, pending) {
      currentButtons.forEach((button) => {
        if (button.dataset.actionId !== actionId) {
          button.disabled = pending;
          return;
        }

        button.disabled = pending;
        button.textContent = pending ? 'Working...' : actionLabel(button.dataset.actionId);
      });

      dangerModal?.setPendingAction(actionId, pending);
    }

    const controller = {
      hideAll,
      hideDanger,
      hideToast,
      setActionPending,
      showActionFeedback,
      showDanger,
      showResult,
      showSafe,
      showScanning,
      showSuspicious,
    };

    return controller;
  }

  globalThis.BrowseShieldOverlay = {
    createOverlayController,
  };
})();
