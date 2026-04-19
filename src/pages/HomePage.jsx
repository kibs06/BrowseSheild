import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import FuzzyText from '../components/FuzzyText';
import { GlassCard } from '../components/GlassCard';
import { InteractiveSurface } from '../components/InteractiveSurface';
import { LoadingPanel } from '../components/LoadingPanel';
import { SectionHeader } from '../components/SectionHeader';
import { ThreatBadge } from '../components/ThreatBadge';
import { useDashboardData } from '../hooks/useBrowseShieldData';
import { features, workflowSteps } from '../data/mockData';

export function HomePage() {
  const { latestScan, loading, recentAlerts, scans = [], status } = useDashboardData();

  const liveStats = useMemo(() => {
    const totalScans = scans.length;
    const neutralizedCount = scans.filter((scan) =>
      ['Blocked', 'Sandboxed'].includes(scan.userAction),
    ).length;
    const averageRiskScore = totalScans
      ? Math.round(scans.reduce((sum, scan) => sum + scan.riskScore, 0) / totalScans)
      : 0;
    const confidence = totalScans
      ? Math.min(
          99,
          Math.round(
            scans.reduce((sum, scan) => sum + Math.min(scan.indicators.length * 8, 24), 62) /
              totalScans,
          ),
        )
      : 0;

    return [
      {
        label: 'Protected sessions',
        value: totalScans ? totalScans.toLocaleString() : '0',
        trend: status.extension,
        tone: 'safe',
      },
      {
        label: 'Threats neutralized',
        value: neutralizedCount.toLocaleString(),
        trend: `+${status.alertsToday} alerts today`,
        tone: neutralizedCount ? 'danger' : 'safe',
      },
      {
        label: 'Avg. risk score',
        value: `${averageRiskScore}`,
        trend: latestScan ? latestScan.riskLevel : 'Awaiting scan',
        tone: latestScan ? latestScan.riskLevel.toLowerCase() : 'primary',
      },
      {
        label: 'Analyst confidence',
        value: `${confidence}%`,
        trend: totalScans ? 'Telemetry active' : 'No live telemetry yet',
        tone: confidence >= 75 ? 'safe' : 'warning',
      },
    ];
  }, [latestScan, scans, status.alertsToday, status.extension]);

  const previewTone = latestScan ? latestScan.riskLevel.toLowerCase() : 'primary';

  return (
    <div className="page home-page">
      <section className="hero-grid">
        <div className="hero-copy">
          <div className="hero-badge">
            <span className="signal-dot" />
            Real-Time Browser Threat Detection and Security Monitoring
          </div>
          <h1 className="hero-fuzzy-title">
            <span className="visually-hidden">BrowseShield</span>
            <span className="hero-fuzzy-canvas" aria-hidden="true">
              <FuzzyText
                className="hero-fuzzy-text"
                fontSize="clamp(3.4rem, 8vw, 6.5rem)"
                fontWeight={900}
                baseIntensity={0.12}
                hoverIntensity={0.28}
                fuzzRange={18}
                fps={42}
                direction="horizontal"
                transitionDuration={180}
                gradient={['#f8fbff', '#8ff3ff', '#00d1ff']}
                letterSpacing={1.5}
              >
                BrowseShield
              </FuzzyText>
            </span>
          </h1>
          <p className="hero-intro">
            BrowseShield is a browser security monitoring platform that detects
            suspicious sites, explains risk signals, and helps users respond with
            confidence before compromise happens.
          </p>
          <div className="hero-actions">
            <InteractiveSurface
              as={Link}
              to="/dashboard"
              className="button button-primary"
              preset="button"
              inlineContent
            >
              Launch Console
            </InteractiveSurface>
            <InteractiveSurface
              as={Link}
              to="/threat-details"
              className="button button-secondary"
              preset="button"
              inlineContent
            >
              View Threat Analysis
            </InteractiveSurface>
          </div>
          <div className="hero-stats">
            {liveStats.map((stat) => (
              <GlassCard
                key={stat.label}
                className="stat-card"
                interactive
                preset="card"
                borderGlow
                ripple
              >
                <span className="stat-label">{stat.label}</span>
                <strong>{stat.value}</strong>
                <span className={`stat-trend tone-${stat.tone}`}>{stat.trend}</span>
              </GlassCard>
            ))}
          </div>
        </div>

        <GlassCard
          className="hero-preview"
          interactive
          preset="heroCard"
          borderGlow
          spotlight
          tilt
          ripple
          spotlightRadius={280}
        >
          <div className="preview-header">
            <div>
              <span className="eyebrow">Live monitor</span>
              <h3>Adaptive Browser Risk Console</h3>
            </div>
            <ThreatBadge tone={previewTone}>
              {latestScan ? `${latestScan.riskLevel} active` : 'Awaiting scan'}
            </ThreatBadge>
          </div>
          {loading ? <LoadingPanel label="Loading live landing telemetry..." /> : null}
          {!loading && latestScan ? (
            <>
              <div className="browser-chrome">
                <span />
                <span />
                <span />
                <div className="browser-url">{latestScan.url}</div>
              </div>
              <div className="preview-grid">
                <div className="preview-panel wide">
                  <div className="panel-label">Threat confidence</div>
                  <div className="scanner-line" />
                  <div className="preview-score">{latestScan.riskScore} / 100</div>
                  <p>{latestScan.summary}</p>
                </div>
                <div className="preview-panel">
                  <div className="panel-label">Extension state</div>
                  <strong>{status.extension}</strong>
                  <span className={`mini-status ${status.extension === 'Connected' ? 'is-safe' : 'is-danger'}`}>
                    {status.protection}
                  </span>
                </div>
                <div className="preview-panel">
                  <div className="panel-label">Action</div>
                  <strong>{latestScan.userAction}</strong>
                  <span
                    className={`mini-status ${
                      ['Blocked', 'Sandboxed'].includes(latestScan.userAction) ? 'is-danger' : 'is-safe'
                    }`}
                  >
                    {latestScan.threatType}
                  </span>
                </div>
                <div className="preview-panel wide log-panel">
                  <div className="panel-label">Signal log</div>
                  {latestScan.indicators.slice(0, 2).map((indicator) => (
                    <code key={indicator}>{indicator}</code>
                  ))}
                  {recentAlerts[0] ? <code>{recentAlerts[0].detail}</code> : null}
                </div>
              </div>
            </>
          ) : null}
          {!loading && !latestScan ? (
            <EmptyState
              title="No live scan yet"
              description="Run the BrowseShield extension on an active website to populate this landing preview with real threat telemetry."
            />
          ) : null}
        </GlassCard>
      </section>

      <section className="content-section">
        <SectionHeader
          eyebrow="Capabilities"
          title="Designed for browser defense and threat intelligence workflows"
          description="Every surface reinforces the idea of active monitoring, analyst visibility, and fast protective decisions."
        />
        <div className="feature-grid">
          {features.map((feature) => (
            <GlassCard
              key={feature.title}
              className="feature-card"
              interactive
              preset="card"
              borderGlow
              ripple
            >
              <span className="feature-tag">{feature.tag}</span>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </GlassCard>
          ))}
        </div>
      </section>

      <section className="content-section">
        <SectionHeader
          eyebrow="How It Works"
          title="From active scan to guided response"
          description="BrowseShield merges technical signal analysis with a clear, human-readable security narrative."
        />
        <div className="workflow-grid">
          {workflowSteps.map((item) => (
            <GlassCard
              key={item.step}
              className="workflow-card"
              interactive
              preset="card"
              borderGlow
              ripple
            >
              <span className="workflow-step">{item.step}</span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </GlassCard>
          ))}
        </div>
      </section>
    </div>
  );
}
