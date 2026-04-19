import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { GlassCard } from '../components/GlassCard';
import { InteractiveSurface } from '../components/InteractiveSurface';
import { LoadingPanel } from '../components/LoadingPanel';
import { SectionHeader } from '../components/SectionHeader';
import { StatusPill } from '../components/StatusPill';
import { ThreatBadge } from '../components/ThreatBadge';
import { markScanDomainTrusted } from '../lib/api/scanRepository';
import { useThreatDetails } from '../hooks/useBrowseShieldData';
import { recordScanFeedback } from '../services/feedback';
import { recordScanAction } from '../services/scanActions';

const ANALYST_PROMPTS = [
  'Why was this flagged?',
  'Is this site safe to log into?',
  'What should I do next?',
  'Explain the tracker count',
  'Summarize this threat simply',
];

function formatThreatTimestamp(value) {
  return value ? new Date(value).toLocaleString() : 'Unavailable';
}

function getLoginFormDetected(scan) {
  return scan?.loginFormDetected ?? scan?.hasLoginForm ?? false;
}

function getSuspiciousKeywords(scan) {
  return scan?.suspiciousKeywords ?? [];
}

function buildInitialAnalystMessage(scan) {
  const loginFormDetected = getLoginFormDetected(scan);
  const suspiciousKeywords = getSuspiciousKeywords(scan);

  return `Analyst brief: ${scan.summary} Current posture is ${scan.riskLevel.toLowerCase()} risk with a score of ${scan.riskScore}/100 for ${scan.hostname}. ${loginFormDetected ? 'A login form was detected on the page.' : 'No login form was detected.'} ${suspiciousKeywords.length ? `Suspicious wording included ${suspiciousKeywords.join(', ')}.` : 'No suspicious keywords were captured.'}`;
}

function buildAnalystResponse(scan, question) {
  const prompt = question.trim().toLowerCase();
  const loginFormDetected = getLoginFormDetected(scan);
  const suspiciousKeywords = getSuspiciousKeywords(scan);
  const recommendations = scan.recommendations ?? [];
  const indicators = scan.indicators ?? [];

  if (prompt.includes('why') || prompt.includes('flagged')) {
    return `BrowseShield flagged this destination as ${scan.threatCategory} because ${indicators.length} primary signal${indicators.length === 1 ? '' : 's'} aligned with the threat model. Key evidence includes ${indicators.join('; ') || 'limited indicator detail'}, ${scan.redirectCount} redirect signal${scan.redirectCount === 1 ? '' : 's'}, and ${scan.trackerCount} tracker-related observation${scan.trackerCount === 1 ? '' : 's'}.`;
  }

  if (prompt.includes('safe') || prompt.includes('log into')) {
    return `I would not recommend logging into this site until you independently verify the destination. The page is rated ${scan.riskLevel.toLowerCase()} risk, ${loginFormDetected ? 'shows a login form' : 'does not show a login form'}, and carries a ${scan.threatCategory} classification with a ${scan.riskScore}/100 score.`;
  }

  if (prompt.includes('next')) {
    return `Next step: ${recommendations[0] ?? 'Pause and verify the destination through a trusted source.'} Follow-up actions from this scan would be to inspect ${scan.rootDomain}, review whether the redirects were expected, and avoid entering credentials until the page is verified.`;
  }

  if (prompt.includes('tracker')) {
    return `The tracker count reflects how many tracker-like assets BrowseShield observed on the page. A count of ${scan.trackerCount} does not prove the site is malicious by itself, but in combination with ${scan.redirectCount} redirects and the ${scan.threatCategory} classification it increases BrowseShield's concern about privacy posture and legitimacy.`;
  }

  if (prompt.includes('summarize') || prompt.includes('simply')) {
    return `Simple summary: BrowseShield saw a ${scan.riskLevel.toLowerCase()}-risk page at ${scan.url} and flagged it as ${scan.threatCategory}. Main reasons were ${indicators.length ? indicators[0] : 'risk signals in the page behavior'}, plus ${scan.trackerCount} tracker signal${scan.trackerCount === 1 ? '' : 's'}${suspiciousKeywords.length ? ` and wording like ${suspiciousKeywords.join(', ')}` : ''}.`;
  }

  return `${scan.aiExplanation || scan.explanation} The scan was recorded at ${formatThreatTimestamp(scan.scannedAt)} from the ${scan.source} source, and the current risk model still treats ${scan.hostname} as ${scan.riskLevel.toLowerCase()} risk.`;
}

export function ThreatDetailsPage() {
  const { scanId } = useParams();
  const [refreshToken, setRefreshToken] = useState(0);
  const [analystInput, setAnalystInput] = useState('');
  const [analystMessages, setAnalystMessages] = useState([]);
  const { error, loading, scan, actions, latestFeedback } = useThreatDetails(scanId, refreshToken);
  const loginFormDetected = getLoginFormDetected(scan);
  const suspiciousKeywords = getSuspiciousKeywords(scan);

  useEffect(() => {
    if (!scan) {
      setAnalystMessages([]);
      return;
    }

    setAnalystInput('');
    setAnalystMessages([
      {
        id: `${scan.id}-initial`,
        role: 'assistant',
        label: 'AI Threat Analyst',
        text: buildInitialAnalystMessage(scan),
      },
    ]);
  }, [scan]);

  async function handleFeedback(feedbackType) {
    if (!scan?.id) {
      return;
    }

    await recordScanFeedback({
      scanId: scan.id,
      feedbackType,
      note: `Submitted from threat details page as ${feedbackType}.`,
    });
    setRefreshToken((value) => value + 1);
  }

  async function handleTrustSite() {
    if (!scan) {
      return;
    }

    await markScanDomainTrusted(scan, 'Trusted from threat details page');
    if (scan.id) {
      await recordScanAction({
        scanId: scan.id,
        actionType: 'trusted_site',
        source: 'web',
      });
    }
    setRefreshToken((value) => value + 1);
  }

  function appendAnalystExchange(question) {
    if (!scan) {
      return;
    }

    const trimmedQuestion = question.trim();

    if (!trimmedQuestion) {
      return;
    }

    setAnalystMessages((current) => [
      ...current,
      {
        id: `user-${Date.now()}`,
        role: 'user',
        label: 'Operator',
        text: trimmedQuestion,
      },
      {
        id: `assistant-${Date.now()}-${current.length}`,
        role: 'assistant',
        label: 'AI Threat Analyst',
        text: buildAnalystResponse(scan, trimmedQuestion),
      },
    ]);
  }

  function handlePromptClick(prompt) {
    appendAnalystExchange(prompt);
  }

  function handleAnalystSubmit(event) {
    event.preventDefault();
    appendAnalystExchange(analystInput);
    setAnalystInput('');
  }

  return (
    <div className="page threat-page">
      <SectionHeader
        eyebrow="Threat Report"
        title="Detailed site intelligence analysis"
        description="A premium analysis view for one suspicious destination, with structured indicators, AI explanation, and recommended action."
      />

      {loading ? <LoadingPanel label="Loading threat report..." /> : null}
      {!loading && !scan ? (
        <GlassCard className="report-card" interactive preset="card" borderGlow ripple>
          <EmptyState
            title="Threat report unavailable"
            description="BrowseShield could not find a scan for this report. Try opening the latest scan from the dashboard or history page."
          />
        </GlassCard>
      ) : null}

      {!loading && scan ? (
      <div className="threat-layout">
        <GlassCard
          className="threat-hero-card"
          interactive
          preset="heroCard"
          borderGlow
          spotlight
          tilt
          ripple
          spotlightRadius={280}
        >
          <div className="card-topline">
            <span className="panel-label">Investigated URL</span>
            <StatusPill
              state={scan.riskLevel === 'Low' ? 'safe' : scan.riskLevel === 'Medium' ? 'warning' : 'danger'}
              label={scan.userAction || 'warned'}
            />
          </div>
          <h2>{scan.url}</h2>
          <div className="threat-tag-row">
            <ThreatBadge tone={scan.riskLevel.toLowerCase()}>{scan.riskLevel}</ThreatBadge>
            <ThreatBadge tone={scan.threatCategory === 'safe' ? 'safe' : 'danger'}>
              {scan.threatCategory}
            </ThreatBadge>
            <ThreatBadge tone="primary">Score {scan.riskScore}</ThreatBadge>
            {scan.trustedStatus ? <ThreatBadge tone="safe">Trusted site</ThreatBadge> : null}
          </div>
          <p className="support-copy">
            {scan.summary}
          </p>
        </GlassCard>

        <GlassCard className="indicator-card" interactive preset="card" borderGlow spotlight ripple spotlightRadius={220}>
          <div className="card-topline">
            <span className="panel-label">Detected indicators</span>
            <ThreatBadge tone="high">{scan.indicators.length} primary signals</ThreatBadge>
          </div>
          <div className="indicator-grid">
            {scan.indicators.map((indicator, index) => (
              <InteractiveSurface
                key={`${indicator}-${index}`}
                className="indicator-item"
                preset="card"
                borderGlow
                ripple
                lift={2}
                scale={1.004}
              >
                <span>Signal {String(index + 1).padStart(2, '0')}</span>
                <strong>{indicator}</strong>
                <ThreatBadge tone={scan.riskLevel.toLowerCase()}>{scan.riskLevel}</ThreatBadge>
              </InteractiveSurface>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="report-card" interactive preset="heroCard" borderGlow spotlight ripple tilt={false} spotlightRadius={240}>
          <div className="card-topline">
            <span className="panel-label">AI explanation</span>
            <ThreatBadge tone="primary">Threat narrative</ThreatBadge>
          </div>
          <p className="analysis-text">{scan.aiExplanation || scan.explanation}</p>
          <p className="support-copy">
            Confidence summary: {scan.indicators.length >= 5
              ? 'multiple independent indicators aligned'
              : scan.indicators.length >= 3
                ? 'several signals support this assessment'
                : 'limited supporting signals'}
          </p>
        </GlassCard>

        <GlassCard className="recommended-card analyst-console-card" interactive preset="card" borderGlow spotlight ripple spotlightRadius={220}>
          <div className="card-topline">
            <span className="panel-label">AI Threat Analyst</span>
            <StatusPill state="safe" label="Context loaded" />
          </div>

          <div className="analyst-console-header">
            <div>
              <h3>Threat Analyst Console</h3>
              <p className="support-copy">
                Investigate this scan through a guided analyst conversation grounded in the current BrowseShield evidence set.
              </p>
            </div>
            <div className="analyst-console-badge">
              <span className="panel-label">Live context</span>
              <strong>{scan.rootDomain}</strong>
              <small>{scan.riskLevel} risk • score {scan.riskScore}</small>
            </div>
          </div>

          <div className="analyst-prompt-row">
            {ANALYST_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="analyst-prompt-button"
                onClick={() => handlePromptClick(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="analyst-message-feed" role="log" aria-live="polite">
            {analystMessages.map((message) => (
              <div key={message.id} className={`analyst-message-bubble analyst-message-bubble--${message.role}`}>
                <span className="analyst-message-meta">{message.label}</span>
                <p>{message.text}</p>
              </div>
            ))}
          </div>

          <form className="analyst-input-shell" onSubmit={handleAnalystSubmit}>
            <input
              type="text"
              className="analyst-input-field"
              value={analystInput}
              onChange={(event) => setAnalystInput(event.target.value)}
              placeholder="Ask about legitimacy, login safety, redirects, or next actions"
              aria-label="Ask the AI Threat Analyst about the current site"
            />
            <button type="submit" className="button button-primary analyst-send-action" disabled={!analystInput.trim()}>
              Send
            </button>
          </form>

          <div className="analyst-context-footer">
            <StatusPill state={loginFormDetected ? 'warning' : 'safe'} label={`Login form: ${loginFormDetected ? 'Detected' : 'Not detected'}`} />
            <StatusPill state={scan.trackerCount > 3 ? 'warning' : 'primary'} label={`Trackers: ${scan.trackerCount}`} />
            <StatusPill state={suspiciousKeywords.length ? 'warning' : 'safe'} label={`Keywords: ${suspiciousKeywords.length ? suspiciousKeywords.join(', ') : 'None'}`} />
          </div>
        </GlassCard>

        <GlassCard className="status-card" interactive preset="card" borderGlow ripple>
          <div className="card-topline">
            <span className="panel-label">Site intelligence</span>
            <ThreatBadge tone="primary">Inspection</ThreatBadge>
          </div>
          <div className="intelligence-grid">
            <InteractiveSurface className="indicator-item" preset="card" borderGlow ripple lift={2} scale={1.004}>
              <span>Protocol</span>
              <strong>{scan.protocol}</strong>
            </InteractiveSurface>
            <InteractiveSurface className="indicator-item" preset="card" borderGlow ripple lift={2} scale={1.004}>
              <span>Hostname</span>
              <strong>{scan.hostname}</strong>
            </InteractiveSurface>
            <InteractiveSurface className="indicator-item" preset="card" borderGlow ripple lift={2} scale={1.004}>
              <span>Root domain</span>
              <strong>{scan.rootDomain}</strong>
            </InteractiveSurface>
            <InteractiveSurface className="indicator-item" preset="card" borderGlow ripple lift={2} scale={1.004}>
              <span>Login form detected</span>
              <strong>{loginFormDetected ? 'Yes' : 'No'}</strong>
            </InteractiveSurface>
            <InteractiveSurface className="indicator-item" preset="card" borderGlow ripple lift={2} scale={1.004}>
              <span>Suspicious keywords</span>
              <strong>{suspiciousKeywords.join(', ') || 'None'}</strong>
            </InteractiveSurface>
            <InteractiveSurface className="indicator-item" preset="card" borderGlow ripple lift={2} scale={1.004}>
              <span>Tracker count</span>
              <strong>{scan.trackerCount}</strong>
            </InteractiveSurface>
            <InteractiveSurface className="indicator-item" preset="card" borderGlow ripple lift={2} scale={1.004}>
              <span>Redirect count</span>
              <strong>{scan.redirectCount}</strong>
            </InteractiveSurface>
            <InteractiveSurface className="indicator-item" preset="card" borderGlow ripple lift={2} scale={1.004}>
              <span>Domain length</span>
              <strong>{scan.domainLength}</strong>
            </InteractiveSurface>
            <InteractiveSurface className="indicator-item" preset="card" borderGlow ripple lift={2} scale={1.004}>
              <span>Subdomain depth</span>
              <strong>{scan.subdomainDepth}</strong>
            </InteractiveSurface>
            <InteractiveSurface className="indicator-item" preset="card" borderGlow ripple lift={2} scale={1.004}>
              <span>Scan source</span>
              <strong>{scan.source}</strong>
            </InteractiveSurface>
            <InteractiveSurface className="indicator-item" preset="card" borderGlow ripple lift={2} scale={1.004}>
              <span>Timestamp</span>
              <strong>{new Date(scan.scannedAt).toLocaleString()}</strong>
            </InteractiveSurface>
            <InteractiveSurface className="indicator-item" preset="card" borderGlow ripple lift={2} scale={1.004}>
              <span>Fingerprint</span>
              <strong>{scan.pageFingerprint}</strong>
            </InteractiveSurface>
          </div>
        </GlassCard>

        <GlassCard className="status-card" interactive preset="card" borderGlow ripple>
          <div className="card-topline">
            <span className="panel-label">Response posture</span>
            <ThreatBadge tone={scan.riskLevel.toLowerCase()}>
              {new Date(scan.scannedAt).toLocaleString()}
            </ThreatBadge>
          </div>
          <div className="status-stack">
            <StatusPill state={scan.hasLoginForm ? 'warning' : 'safe'} label={`Login form: ${scan.hasLoginForm ? 'Yes' : 'No'}`} />
            <StatusPill state={scan.trackerCount > 3 ? 'warning' : 'safe'} label={`Tracker signals: ${scan.trackerCount}`} />
            <StatusPill state={scan.source === 'extension' ? 'safe' : 'primary'} label={`Source: ${scan.source}`} />
            <StatusPill state={scan.trustedStatus ? 'safe' : 'warning'} label={scan.trustedStatus ? 'Trusted domain' : 'Untrusted domain'} />
          </div>
        </GlassCard>

        <GlassCard className="status-card" interactive preset="card" borderGlow ripple>
          <div className="card-topline">
            <span className="panel-label">Workflow actions</span>
            <ThreatBadge tone="warning">{actions.length} logged</ThreatBadge>
          </div>
          <div className="status-stack">
            {actions.map((action) => (
              <StatusPill
                key={action.id}
                state={action.actionType === 'trusted_site' ? 'safe' : action.actionType === 'continued_anyway' ? 'warning' : 'primary'}
                label={`${action.actionType} â€¢ ${new Date(action.createdAt).toLocaleString()}`}
              />
            ))}
            {!actions.length ? <EmptyState title="No workflow actions yet" description="Extension and web-app responses will be logged here." /> : null}
          </div>
        </GlassCard>

        <GlassCard className="status-card" interactive preset="card" borderGlow spotlight ripple spotlightRadius={220}>
          <div className="card-topline">
            <span className="panel-label">Feedback and trust controls</span>
            <ThreatBadge tone="primary">Analyst input</ThreatBadge>
          </div>
          <div className="feedback-actions">
            <InteractiveSurface
              as="button"
              type="button"
              className="button button-ghost"
              preset="button"
              inlineContent
              onClick={() => handleFeedback('false_positive')}
            >
              Mark False Positive
            </InteractiveSurface>
            <InteractiveSurface
              as="button"
              type="button"
              className="button button-ghost"
              preset="button"
              inlineContent
              onClick={() => handleFeedback('helpful_warning')}
            >
              Useful Warning
            </InteractiveSurface>
            <InteractiveSurface
              as="button"
              type="button"
              className="button button-ghost"
              preset="button"
              inlineContent
              onClick={() => handleFeedback('rescan_requested')}
            >
              Review Again
            </InteractiveSurface>
            <InteractiveSurface
              as="button"
              type="button"
              className="button button-primary"
              preset="button"
              inlineContent
              onClick={handleTrustSite}
            >
              Trust Site
            </InteractiveSurface>
          </div>
          <p className="support-copy">
            Latest feedback: {latestFeedback ? `${latestFeedback.feedbackType} at ${new Date(latestFeedback.createdAt).toLocaleString()}` : 'No feedback recorded yet.'}
          </p>
        </GlassCard>
      </div>
      ) : null}
      {error ? <p className="support-copy page-message">{error}</p> : null}
    </div>
  );
}
