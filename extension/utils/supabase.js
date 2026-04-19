import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config.js';

function isConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

function baseHeaders() {
  return {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };
}

function normalizeDomain(domain = '') {
  const trimmed = String(domain).trim();
  if (!trimmed) {
    return '';
  }

  try {
    return new URL(trimmed).hostname.toLowerCase();
  } catch {
    return trimmed.toLowerCase();
  }
}

function toInsertPayload(scan) {
  return {
    url: scan.url,
    title: scan.title,
    risk_level: scan.riskLevel,
    risk_score: scan.riskScore,
    indicators: scan.indicators,
    summary: scan.summary,
    explanation: scan.explanation,
    ai_explanation: scan.aiExplanation,
    recommendations: scan.recommendations,
    threat_type: scan.threatType,
    threat_category: scan.threatCategory,
    threat_categories: scan.threatCategories,
    user_action: scan.userAction,
    source: scan.source ?? 'extension',
    trusted_status: scan.trustedStatus,
    has_login_form: scan.hasLoginForm,
    login_form_detected: scan.loginFormDetected,
    tracker_count: scan.trackerCount,
    redirect_count: scan.redirectCount,
    suspicious_keywords: scan.suspiciousKeywords,
    protocol: scan.protocol,
    hostname: scan.hostname,
    root_domain: scan.rootDomain,
    domain_length: scan.domainLength,
    subdomain_depth: scan.subdomainDepth,
    favicon_url: scan.faviconUrl,
    page_fingerprint: scan.pageFingerprint,
    scanned_at: scan.scannedAt,
  };
}

async function request(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, options);
  if (!response.ok) {
    throw new Error(await response.text());
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  return null;
}

function extractMissingColumnName(message = '') {
  const schemaCacheMatch = message.match(/Could not find the '([^']+)' column/);
  if (schemaCacheMatch) {
    return schemaCacheMatch[1];
  }

  const relationMatch = message.match(/column \"([^\"]+)\" of relation/);
  if (relationMatch) {
    return relationMatch[1];
  }

  return '';
}

function removeColumnFromPayload(payload, column) {
  if (Array.isArray(payload)) {
    return payload.map((item) => {
      if (!item || typeof item !== 'object') {
        return item;
      }

      const { [column]: _ignored, ...rest } = item;
      return rest;
    });
  }

  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  const { [column]: _ignored, ...rest } = payload;
  return rest;
}

function isActionTypeConstraintError(error) {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('scan_actions_action_type_check') ||
    (message.includes('violates check constraint') && message.includes('scan_actions')) ||
    message.includes('action_type')
  );
}

function getActionTypeCandidates(actionType) {
  const fallbacks = {
    suspicious_notified: ['suspicious_notified', 'warned'],
    danger_blocked: ['danger_blocked', 'warned'],
    viewed_report: ['viewed_report'],
    continued_anyway: ['continued_anyway'],
    trusted_site: ['trusted_site'],
    left_site: ['left_site'],
    warned: ['warned'],
    scanned: ['scanned', 'warned'],
    safe_notified: ['safe_notified', 'warned'],
  };

  return fallbacks[actionType] ?? [actionType];
}

async function requestWithSchemaFallback(path, buildOptions, initialPayload, maxAttempts = 20) {
  let payload = initialPayload;
  const removedColumns = new Set();

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await request(path, buildOptions(payload));
    } catch (error) {
      const missingColumn = extractMissingColumnName(error.message || '');
      if (!missingColumn || removedColumns.has(missingColumn)) {
        throw error;
      }

      removedColumns.add(missingColumn);
      payload = removeColumnFromPayload(payload, missingColumn);
    }
  }

  throw new Error('Unable to write to Supabase because the table schema is missing too many expected columns.');
}

export async function persistScanResult(scan) {
  if (!isConfigured()) {
    return {
      ok: false,
      skipped: true,
      reason: 'Supabase credentials are not configured in extension/config.js',
    };
  }

  const data = await requestWithSchemaFallback(
    '/rest/v1/scan_results',
    (payload) => ({
      method: 'POST',
      headers: {
        ...baseHeaders(),
        Prefer: 'return=representation',
      },
      body: JSON.stringify(payload),
    }),
    [toInsertPayload(scan)],
  );

  const [record] = data;
  return {
    ok: true,
    id: record.id,
  };
}

export async function findTrustedSite(domain) {
  if (!isConfigured()) {
    return null;
  }

  const normalizedDomain = normalizeDomain(domain);
  if (!normalizedDomain) {
    return null;
  }

  const data = await request(
    `/rest/v1/trusted_sites?domain=eq.${encodeURIComponent(normalizedDomain)}&select=*`,
    {
      method: 'GET',
      headers: baseHeaders(),
    },
  );

  return data[0] ?? null;
}

export async function addTrustedSite({ domain, reason = 'Trusted by user', source = 'extension', notes = '' }) {
  if (!isConfigured()) {
    return {
      ok: false,
      skipped: true,
      reason: 'Supabase credentials are not configured in extension/config.js',
    };
  }

  const normalizedDomain = normalizeDomain(domain);
  if (!normalizedDomain) {
    throw new Error('No valid domain was available to trust.');
  }

  const data = await request('/rest/v1/trusted_sites?on_conflict=domain', {
    method: 'POST',
    headers: {
      ...baseHeaders(),
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify([
      {
        domain: normalizedDomain,
        reason,
        source,
        notes,
      },
    ]),
  });

  const trustedSite = data?.[0] ?? (await findTrustedSite(normalizedDomain));
  if (!trustedSite) {
    throw new Error('Trusted site save completed without a returned record.');
  }

  return {
    ok: true,
    trustedSite,
  };
}

export async function updateScanResult(scanId, updates) {
  if (!isConfigured() || !scanId) {
    return {
      ok: false,
      skipped: true,
      reason: !scanId ? 'No saved scan record is available yet.' : 'Supabase is not configured.',
    };
  }

  await requestWithSchemaFallback(
    `/rest/v1/scan_results?id=eq.${scanId}`,
    (payload) => ({
      method: 'PATCH',
      headers: {
        ...baseHeaders(),
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(payload),
    }),
    updates,
  );

  return {
    ok: true,
  };
}

export async function recordScanAction({
  scanId,
  actionType,
  pageUrl = '',
  source = 'extension',
  updateUserAction = true,
}) {
  if (!isConfigured() || !scanId) {
    return {
      ok: false,
      skipped: true,
      reason: !scanId ? 'No saved scan record is available yet.' : 'Supabase is not configured.',
    };
  }

  const actionTypeCandidates = getActionTypeCandidates(actionType);
  let lastError = null;

  for (const candidateActionType of actionTypeCandidates) {
    try {
      const data = await requestWithSchemaFallback(
        '/rest/v1/scan_actions',
        (payload) => ({
          method: 'POST',
          headers: {
            ...baseHeaders(),
            Prefer: 'return=representation',
          },
          body: JSON.stringify(payload),
        }),
        [
          {
            scan_id: scanId,
            action_type: candidateActionType,
            page_url: pageUrl,
            source,
          },
        ],
      );

      if (updateUserAction) {
        await updateScanResult(scanId, {
          user_action: candidateActionType,
        });
      }

      return {
        ok: true,
        action: data[0],
        actionType: candidateActionType,
        downgradedFrom: candidateActionType === actionType ? null : actionType,
      };
    } catch (error) {
      lastError = error;
      if (!isActionTypeConstraintError(error)) {
        throw error;
      }
    }
  }

  if (isActionTypeConstraintError(lastError)) {
    return {
      ok: false,
      skipped: true,
      reason: `The current scan_actions table does not allow the "${actionType}" action yet.`,
    };
  }

  throw lastError;
}
