(() => {
  const CONTINUE_UNLOCK_DELAY_MS = 1600;

  function truncateIndicators(indicators = [], limit = 4) {
    return indicators.slice(0, limit);
  }

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

  function createButton(label, actionId, variant = 'secondary') {
    const button = createElement('button', 'browseshield-button', label);
    button.type = 'button';
    button.dataset.actionId = actionId;
    button.dataset.variant = variant;
    return button;
  }

  function createDangerModal({ onAction } = {}) {
    const backdrop = createElement('div', 'browseshield-danger-backdrop');
    const panel = createElement('section', 'browseshield-danger-panel');
    const header = createElement('div', 'browseshield-danger-header');
    const eyebrowBlock = createElement('div');
    const eyebrow = createElement('span', 'browseshield-eyebrow', 'Emergency Warning');
    const title = createElement('h2', 'browseshield-danger-title', 'Dangerous site detected');
    const badge = createElement('span', 'browseshield-danger-chip', 'High Risk');
    const copy = createElement('p', 'browseshield-danger-copy');
    const grid = createElement('div', 'browseshield-danger-grid');
    const summary = createElement('div', 'browseshield-danger-summary');
    const meta = createElement('div', 'browseshield-danger-meta');
    const siteLabel = createElement('span', 'browseshield-toast-site-label', 'Current site');
    const siteValue = createElement('strong', 'browseshield-toast-site-value');
    const scoreBox = createElement('div', 'browseshield-score');
    const scoreValue = createElement('strong', '', '0');
    const scoreLabel = createElement('span', '', 'Risk');
    const indicators = createElement('ul', 'browseshield-indicator-list');
    const actions = createElement('div', 'browseshield-danger-actions');
    const leaveButton = createButton('Leave Site', 'leave_site', 'danger');
    const continueButton = createButton('Continue Anyway', 'continue_anyway', 'warning');
    const viewReportButton = createButton('View Full Report', 'view_report', 'primary');
    const footnote = createElement(
      'p',
      'browseshield-danger-footnote',
      'Continue Anyway is temporarily disabled so the user has a moment to review the warning.',
    );

    let continueUnlockTimer = null;
    let previousHtmlOverflow = '';
    let previousBodyOverflow = '';

    scoreBox.append(scoreValue, scoreLabel);
    eyebrowBlock.append(eyebrow, title);
    header.append(eyebrowBlock, badge);
    meta.append(createElement('div', 'browseshield-toast-site'), scoreBox);
    meta.firstElementChild.append(siteLabel, siteValue);
    summary.append(meta, indicators);
    actions.append(leaveButton, continueButton, viewReportButton);
    grid.append(summary);
    panel.append(header, copy, grid, actions, footnote);
    backdrop.append(panel);

    [leaveButton, continueButton, viewReportButton].forEach((button) => {
      button.addEventListener('click', () => {
        if (typeof onAction === 'function' && !button.disabled) {
          onAction(button.dataset.actionId);
        }
      });
    });

    function lockPageScroll() {
      previousHtmlOverflow = document.documentElement.style.overflow;
      previousBodyOverflow = document.body?.style?.overflow ?? '';
      document.documentElement.style.overflow = 'hidden';
      if (document.body) {
        document.body.style.overflow = 'hidden';
      }
    }

    function unlockPageScroll() {
      document.documentElement.style.overflow = previousHtmlOverflow;
      if (document.body) {
        document.body.style.overflow = previousBodyOverflow;
      }
    }

    function clearContinueTimer() {
      if (continueUnlockTimer) {
        window.clearTimeout(continueUnlockTimer);
        continueUnlockTimer = null;
      }
    }

    function renderIndicators(indicatorItems = []) {
      indicators.innerHTML = '';
      truncateIndicators(indicatorItems).forEach((indicator) => {
        indicators.append(createElement('li', '', indicator));
      });
    }

    function show({ scan }) {
      title.textContent = scan.riskLevel === 'Critical' ? 'Critical threat detected' : 'Dangerous site detected';
      badge.textContent = `${scan.riskLevel} Risk`;
      copy.textContent = scan.summary || scan.warningMessage || 'BrowseShield detected a high-risk browsing session.';
      siteValue.textContent = scan.url || scan.hostname || 'Unknown site';
      scoreValue.textContent = String(scan.riskScore ?? 0);
      renderIndicators(scan.indicators?.length ? scan.indicators : ['Dangerous browsing indicators were detected.']);
      continueButton.disabled = true;
      continueButton.textContent = 'Continue Anyway';
      clearContinueTimer();
      continueUnlockTimer = window.setTimeout(() => {
        continueButton.disabled = false;
      }, CONTINUE_UNLOCK_DELAY_MS);
      lockPageScroll();
      backdrop.classList.add('is-visible');
    }

    function hide() {
      clearContinueTimer();
      backdrop.classList.remove('is-visible');
      unlockPageScroll();
      setPendingAction(null, false);
    }

    function setPendingAction(actionId, pending) {
      [leaveButton, continueButton, viewReportButton].forEach((button) => {
        if (button.dataset.actionId !== actionId) {
          button.disabled = pending;
          return;
        }

        button.disabled = pending;
        button.textContent = pending ? 'Working...' : button.dataset.actionId === 'leave_site'
          ? 'Leave Site'
          : button.dataset.actionId === 'continue_anyway'
            ? 'Continue Anyway'
            : 'View Full Report';
      });
    }

    return {
      element: backdrop,
      hide,
      show,
      setPendingAction,
    };
  }

  globalThis.BrowseShieldDangerModal = {
    createDangerModal,
  };
})();
