import { useState } from 'react';
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

export function ThreatDetailsPage() {
  const { scanId } = useParams();
  const [refreshToken, setRefreshToken] = useState(0);
  const { error, loading, scan, actions, latestFeedback } = useThreatDetails(scanId, refreshToken);

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

        <GlassCard className="recommended-card" interactive preset="card" borderGlow spotlight ripple spotlightRadius={220}>
          <div className="card-topline">
            <span className="panel-label">Recommended actions</span>
            <StatusPill state="warning" label="Immediate response" />
          </div>
          <div className="recommendation-list">
            {scan.recommendations.map((recommendation) => (
              <div key={recommendation} className="recommendation-item">
                <span className="recommendation-mark" />
                <p>{recommendation}</p>
              </div>
            ))}
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
              <strong>{scan.loginFormDetected ? 'Yes' : 'No'}</strong>
            </InteractiveSurface>
            <InteractiveSurface className="indicator-item" preset="card" borderGlow ripple lift={2} scale={1.004}>
              <span>Suspicious keywords</span>
              <strong>{scan.suspiciousKeywords.join(', ') || 'None'}</strong>
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
                label={`${action.actionType} • ${new Date(action.createdAt).toLocaleString()}`}
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
