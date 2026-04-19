const riskPill = document.getElementById('risk-pill');
const scorePill = document.getElementById('score-pill');
const categoryPill = document.getElementById('category-pill');
const trustPill = document.getElementById('trust-pill');
const siteUrl = document.getElementById('site-url');
const warningText = document.getElementById('warning-text');
const indicatorList = document.getElementById('indicator-list');
const footerNote = document.getElementById('footer-note');
const scanButton = document.getElementById('scan-button');
const viewReportButton = document.getElementById('view-report-button');
const leaveButton = document.getElementById('leave-button');
const trustButton = document.getElementById('trust-button');
const continueButton = document.getElementById('continue-button');
const dashboardButton = document.getElementById('dashboard-button');

const actionButtons = [scanButton, viewReportButton, leaveButton, trustButton, continueButton, dashboardButton];
const actionSuccessMessages = {
  VIEW_REPORT: 'Opening the full report.',
  LEAVE_SITE: 'Leaving the current site.',
  TRUST_SITE: 'Site marked as trusted.',
  CONTINUE_ANYWAY: 'Marked this scan as "Continue Anyway".',
};

function setButtonState(disabled) {
  actionButtons.forEach((button) => {
    button.disabled = disabled;
  });
}

function setFooterMessage(message) {
  footerNote.textContent = message;
}

function renderIndicators(indicators) {
  indicatorList.innerHTML = '';

  const entries = indicators.length ? indicators : ['No indicators were detected during this scan.'];
  entries.forEach((indicator) => {
    const item = document.createElement('li');
    item.textContent = indicator;
    indicatorList.appendChild(item);
  });
}

function renderScan(scan, persistence) {
  riskPill.textContent = scan.riskLevel;
  riskPill.className = `risk-pill tone-${scan.riskLevel.toLowerCase()}`;
  scorePill.textContent = `${scan.riskScore} / 100`;
  categoryPill.textContent = scan.threatCategory || scan.threatType || 'No category';
  trustPill.textContent = scan.trustedStatus ? 'Trusted site' : 'Not trusted';
  trustPill.className = `meta-pill ${scan.trustedStatus ? 'is-trusted' : ''}`.trim();
  siteUrl.textContent = scan.url;
  warningText.textContent = scan.warningMessage || scan.summary;
  renderIndicators(scan.indicators || []);

  if (persistence?.ok) {
    setFooterMessage('Scan saved to Supabase and ready for the web dashboard.');
    return;
  }

  if (persistence?.skipped) {
    setFooterMessage(persistence.reason);
    return;
  }

  if (persistence?.error) {
    setFooterMessage(`Scan completed, but Supabase save failed: ${persistence.error}`);
    return;
  }

  setFooterMessage('Latest scan is available in the popup. Configure Supabase to persist it to the dashboard.');
}

function renderError(message) {
  riskPill.textContent = 'Error';
  riskPill.className = 'risk-pill tone-critical';
  scorePill.textContent = '-- / 100';
  categoryPill.textContent = 'Unavailable';
  trustPill.textContent = 'Unknown';
  trustPill.className = 'meta-pill';
  siteUrl.textContent = 'Unable to scan this page';
  warningText.textContent = message;
  renderIndicators([]);
  setFooterMessage(message);
}

function renderActionError(message) {
  setFooterMessage(message);
}

async function requestLastScan() {
  const response = await chrome.runtime.sendMessage({ type: 'GET_LAST_SCAN' });
  if (response?.ok && response.scan) {
    renderScan(response.scan, {
      ok: Boolean(response.scan.persisted),
      skipped: !response.scan.persisted && Boolean(response.scan.persistenceReason),
      reason: response.scan.persistenceReason,
    });
  }
}

async function runScan() {
  setButtonState(true);
  scanButton.textContent = 'Scanning...';

  try {
    const response = await chrome.runtime.sendMessage({ type: 'RUN_ACTIVE_SCAN' });

    if (!response?.ok) {
      renderError(response?.error || 'BrowseShield could not scan the active tab.');
      return;
    }

    renderScan(response.scan, response.persistence);
  } catch (error) {
    renderError(error.message || 'BrowseShield could not scan the active tab.');
  } finally {
    setButtonState(false);
    scanButton.textContent = 'Scan Active Page';
  }
}

async function performAction(type) {
  setButtonState(true);

  try {
    const response = await chrome.runtime.sendMessage({ type });
    if (!response?.ok) {
      renderActionError(response?.error || 'BrowseShield could not complete that action.');
      return;
    }

    if (response.scan) {
      renderScan(response.scan, {
        ok: Boolean(response.scan.persisted),
        skipped: !response.scan.persisted && Boolean(response.scan.persistenceReason),
        reason: response.scan.persistenceReason,
      });
      if (response.notice) {
        setFooterMessage(response.notice);
      }
      return;
    }

    setFooterMessage(response.notice || actionSuccessMessages[type] || 'Action completed.');
  } catch (error) {
    renderActionError(error.message || 'BrowseShield could not complete that action.');
  } finally {
    setButtonState(false);
  }
}

scanButton.addEventListener('click', runScan);
viewReportButton.addEventListener('click', () => performAction('VIEW_REPORT'));
leaveButton.addEventListener('click', () => performAction('LEAVE_SITE'));
trustButton.addEventListener('click', () => performAction('TRUST_SITE'));
continueButton.addEventListener('click', () => performAction('CONTINUE_ANYWAY'));
dashboardButton.addEventListener('click', () => {
  setFooterMessage('Opening the BrowseShield dashboard.');
  chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' }).catch((error) => {
    renderActionError(error.message || 'BrowseShield could not open the dashboard.');
  });
});

requestLastScan();
