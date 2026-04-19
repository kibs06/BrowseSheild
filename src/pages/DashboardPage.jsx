import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertFeed } from '../components/AlertFeed';
import { EmptyState } from '../components/EmptyState';
import { FlaggedDomainsCard } from '../components/FlaggedDomainsCard';
import { GlassCard } from '../components/GlassCard';
import { InteractiveSurface } from '../components/InteractiveSurface';
import { LoadingPanel } from '../components/LoadingPanel';
import { MiniBarChart } from '../components/MiniBarChart';
import { RiskGauge } from '../components/RiskGauge';
import { ResponseActionsCard } from '../components/ResponseActionsCard';
import { SectionHeader } from '../components/SectionHeader';
import { StatusPill } from '../components/StatusPill';
import { ThreatBadge } from '../components/ThreatBadge';
import { TrendAnalyticsCard } from '../components/TrendAnalyticsCard';
import { TrustedDomainsCard } from '../components/TrustedDomainsCard';
import { useDashboardData } from '../hooks/useBrowseShieldData';

export function DashboardPage() {
  const [analyticsRange, setAnalyticsRange] = useState('7d');
  const {
    actions,
    error,
    feedback,
    latestScan,
    loading,
    mode,
    recentAlerts,
    recommendations,
    refresh,
    status,
    threatStats,
    trustedSites,
    analytics,
    scans,
  } = useDashboardData();

  const latestRiskTone = latestScan?.riskLevel?.toLowerCase() ?? 'safe';
  const topThreatStats = useMemo(() => threatStats.slice(0, 6), [threatStats]);

  return (
    <div className="page dashboard-page">
      <SectionHeader
        eyebrow="Operations Console"
        title="Threat monitoring dashboard"
        description="An asymmetrical cyber-defense console for live browser telemetry, risk scoring, and guided mitigation."
        action={
          <InteractiveSurface
            as="button"
            type="button"
            className="button button-ghost"
            preset="button"
            inlineContent
            onClick={refresh}
          >
            Refresh feed
          </InteractiveSurface>
        }
      />

      <div className="dashboard-layout">
        <GlassCard className="system-card" interactive preset="card" borderGlow ripple>
          <div className="card-topline">
            <span className="panel-label">System status</span>
            <StatusPill
              state={mode === 'supabase' ? 'safe' : 'warning'}
              label={mode === 'supabase' ? 'Realtime sync online' : 'Using demo fallback'}
            />
          </div>
          <div className="system-grid">
            <div>
              <span className="meta-label">Extension</span>
              <strong>{status.extension}</strong>
            </div>
            <div>
              <span className="meta-label">Protection</span>
              <strong>{status.protection}</strong>
            </div>
            <div>
              <span className="meta-label">Today's alerts</span>
              <strong>{status.alertsToday}</strong>
            </div>
          </div>
        </GlassCard>

        <GlassCard
          className="scanner-card"
          interactive
          preset="heroCard"
          borderGlow
          spotlight
          tilt
          ripple
          spotlightRadius={280}
        >
          <div className="card-topline">
            <span className="panel-label">Live threat scanner</span>
            <ThreatBadge tone={latestRiskTone}>
              {latestScan ? `${latestScan.riskLevel} scan` : 'Awaiting scan'}
            </ThreatBadge>
          </div>
          {loading ? <LoadingPanel label="Loading scan telemetry..." /> : null}
          {!loading && latestScan ? (
            <div className="scanner-panel">
              <div className="scanner-bar" />
              <div className="scanner-copy">
                <span className="meta-label">Current site URL</span>
                <h3>{latestScan.url}</h3>
                <p>{latestScan.summary}</p>
              </div>
              <div className="scanner-meta">
                <div>
                  <span className="meta-label">Indicators found</span>
                  <strong>{latestScan.indicators.length}</strong>
                </div>
                <div>
                  <span className="meta-label">Scanner mode</span>
                  <strong>{latestScan.source}</strong>
                </div>
              </div>
            </div>
          ) : null}
          {!loading && !latestScan ? (
            <EmptyState
              title="No scan results yet"
              description="Run the extension on an active tab to populate the live scanner panel."
            />
          ) : null}
        </GlassCard>

        <GlassCard className="gauge-card" interactive preset="card" borderGlow ripple>
          <div className="card-topline">
            <span className="panel-label">Risk meter</span>
            <ThreatBadge tone={latestRiskTone}>{latestScan?.riskLevel ?? 'Low'}</ThreatBadge>
          </div>
          <RiskGauge
            value={latestScan?.riskScore ?? 0}
            label={latestScan?.riskLevel ?? 'Low'}
            tone={latestRiskTone}
          />
          <p className="support-copy">
            {latestScan
              ? 'Risk score combines URL posture, phishing wording, login-form context, and tracker-related signals.'
              : 'Risk score will appear once the extension submits the latest scan.'}
          </p>
        </GlassCard>

        <GlassCard className="alerts-card" interactive preset="card" borderGlow ripple>
          <div className="card-topline">
            <span className="panel-label">Recent alerts feed</span>
            <InteractiveSurface
              as={Link}
              to="/history"
              className="button button-ghost"
              preset="button"
              inlineContent
            >
              Open history
            </InteractiveSurface>
          </div>
          {loading ? <LoadingPanel label="Loading alerts..." /> : null}
          {!loading && recentAlerts.length ? <AlertFeed items={recentAlerts} /> : null}
          {!loading && !recentAlerts.length ? (
            <EmptyState
              title="No recent high-risk alerts"
              description="Critical and high-risk scans will appear here after the extension starts sending results."
            />
          ) : null}
        </GlassCard>

        <GlassCard
          className="analysis-card"
          interactive
          preset="heroCard"
          borderGlow
          spotlight
          ripple
          spotlightRadius={240}
          tilt={false}
        >
          <div className="card-topline">
            <span className="panel-label">AI analysis</span>
            <ThreatBadge tone="high">Analyst assist</ThreatBadge>
          </div>
          {loading ? <LoadingPanel label="Preparing threat narrative..." /> : null}
          {!loading ? (
            <p className="analysis-text">
              {latestScan?.aiExplanation ??
                'AI explanation scaffolding is enabled. Once a scan is available, BrowseShield will summarize the strongest risk indicators in beginner-friendly language.'}
            </p>
          ) : null}
        </GlassCard>

        <GlassCard
          className="recommendations-card"
          interactive
          preset="card"
          borderGlow
          spotlight
          ripple
          spotlightRadius={220}
        >
          <div className="card-topline">
            <span className="panel-label">Quick recommendations</span>
            <StatusPill
              state={recommendations.length ? 'warning' : 'safe'}
              label={`${recommendations.length} response actions`}
            />
          </div>
          <div className="recommendation-list">
            {recommendations.map((recommendation) => (
              <div key={recommendation} className="recommendation-item">
                <span className="recommendation-mark" />
                <p>{recommendation}</p>
              </div>
            ))}
          </div>
          {!loading && !recommendations.length ? (
            <EmptyState
              title="No immediate actions"
              description="Recommendations will be generated automatically from the latest scan result."
            />
          ) : null}
        </GlassCard>

        <GlassCard className="stats-card" interactive preset="card" borderGlow ripple scale={1.01}>
          <div className="card-topline">
            <span className="panel-label">Threat statistics</span>
            <ThreatBadge tone="warning">24h</ThreatBadge>
          </div>
          {loading ? <LoadingPanel label="Calculating threat mix..." /> : null}
          {!loading && topThreatStats.length ? <MiniBarChart items={topThreatStats} /> : null}
          {!loading && !topThreatStats.length ? (
            <EmptyState
              title="No statistics yet"
              description="Threat categories will populate once BrowseShield collects scan data."
            />
          ) : null}
        </GlassCard>
      </div>
      <div className="dashboard-analytics-grid">
        <GlassCard className="analytics-summary-card" interactive preset="card" borderGlow ripple>
          {loading ? <LoadingPanel label="Loading trend analytics..." /> : null}
          {!loading ? (
            <TrendAnalyticsCard
              scans={scans}
              analytics={analytics}
              range={analyticsRange}
              onRangeChange={setAnalyticsRange}
            />
          ) : null}
        </GlassCard>

        <GlassCard className="trusted-card" interactive preset="card" borderGlow ripple>
          {loading ? <LoadingPanel label="Loading trusted domains..." /> : null}
          {!loading && trustedSites.length ? (
            <TrustedDomainsCard
              trustedSites={trustedSites}
              scans={scans}
              trustedDomainsCount={analytics.trustedDomainsCount}
            />
          ) : null}
          {!loading && !trustedSites.length ? (
            <EmptyState
              title="No trusted domains yet"
              description="Trusted sites you approve from the extension or details page will appear here."
            />
          ) : null}
        </GlassCard>

        <GlassCard className="actions-card" interactive preset="card" borderGlow ripple>
          {loading ? <LoadingPanel label="Loading response actions..." /> : null}
          {!loading ? (
            <ResponseActionsCard
              scans={scans}
              actions={actions}
              feedback={feedback}
              range={analyticsRange}
            />
          ) : null}
        </GlassCard>

        <GlassCard className="domains-card" interactive preset="card" borderGlow ripple>
          {loading ? <LoadingPanel label="Loading top domains..." /> : null}
          {!loading ? (
            <FlaggedDomainsCard
              scans={scans}
              range={analyticsRange}
              falsePositiveCount={analytics.falsePositiveCount}
            />
          ) : null}
        </GlassCard>
      </div>
      {error ? <p className="support-copy page-message">{error}</p> : null}
    </div>
  );
}
