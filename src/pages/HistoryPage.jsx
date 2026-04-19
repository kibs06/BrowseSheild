import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { FilterChips } from '../components/FilterChips';
import { GlassCard } from '../components/GlassCard';
import { InteractiveSurface } from '../components/InteractiveSurface';
import { LoadingPanel } from '../components/LoadingPanel';
import { SectionHeader } from '../components/SectionHeader';
import { ThreatBadge } from '../components/ThreatBadge';
import { markScanDomainTrusted } from '../lib/api/scanRepository';
import { useHistoryData } from '../hooks/useBrowseShieldData';
import { recordScanFeedback } from '../services/feedback';

const filters = ['all', 'phishing suspected', 'insecure connection', 'suspicious login', 'tracker-heavy'];
const riskLevels = ['all', 'Low', 'Medium', 'High', 'Critical'];
const actionFilters = ['all', 'warned', 'left_site', 'viewed_report', 'trusted_site', 'continued_anyway'];
const trustedFilters = ['all', 'trusted', 'untrusted'];

export function HistoryPage() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [riskLevel, setRiskLevel] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [trustedFilter, setTrustedFilter] = useState('all');
  const [refreshToken, setRefreshToken] = useState(0);
  const { error, loading, scans } = useHistoryData({
    threatCategory: activeFilter,
    riskLevel,
    userAction: actionFilter,
    trustedStatus: trustedFilter,
    search,
    refreshToken,
  });

  async function handleTrustSite(scan) {
    await markScanDomainTrusted(scan, 'Trusted from history page');
    setRefreshToken((value) => value + 1);
  }

  async function handleFalsePositive(scan) {
    await recordScanFeedback({
      scanId: scan.id,
      feedbackType: 'false_positive',
      note: 'Marked as false positive from history page.',
    });
    setRefreshToken((value) => value + 1);
  }

  return (
    <div className="page history-page">
      <SectionHeader
        eyebrow="Incident Archive"
        title="Detection history and incident log"
        description="A searchable-style incident stream with filterable browser threats, mitigation actions, and context for follow-up review."
        action={
          <label className="search-shell">
            <span>Search incidents</span>
            <input
              type="text"
              placeholder="domain, threat type, action..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        }
      />

      <GlassCard className="history-shell" interactive preset="card" borderGlow ripple>
        <div className="history-toolbar">
          <FilterChips
            filters={filters}
            activeFilter={activeFilter}
            onChange={setActiveFilter}
          />
          <div className="history-control-grid">
            <label className="search-shell">
              <span>Risk level</span>
              <select value={riskLevel} onChange={(event) => setRiskLevel(event.target.value)}>
                {riskLevels.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="search-shell">
              <span>User action</span>
              <select value={actionFilter} onChange={(event) => setActionFilter(event.target.value)}>
                {actionFilters.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="search-shell">
              <span>Trusted status</span>
              <select value={trustedFilter} onChange={(event) => setTrustedFilter(event.target.value)}>
                {trustedFilters.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="history-table">
          <div className="history-head">
            <span>URL</span>
            <span>Date / Time</span>
            <span>Risk</span>
            <span>Threat Type</span>
            <span>Action</span>
          </div>
          {loading ? <LoadingPanel label="Loading detection history..." /> : null}
          {!loading &&
            scans.map((entry) => (
              <InteractiveSurface
                key={entry.id}
                as="details"
                className="history-row"
                preset="row"
                borderGlow
                spotlight
                spotlightRadius={240}
              >
                <summary>
                  <span className="history-url">
                    <strong>{entry.url}</strong>
                    <small>{entry.id}</small>
                  </span>
                  <span>{new Date(entry.scannedAt).toLocaleString()}</span>
                  <span>
                    <ThreatBadge tone={entry.riskLevel.toLowerCase()}>{entry.riskLevel}</ThreatBadge>
                  </span>
                  <span className="type-cap">{entry.threatCategory}</span>
                  <span className="action-cell">{entry.userAction}</span>
                </summary>
                <div className="history-details">
                  {entry.indicators.map((indicator) => (
                    <span key={indicator} className="detail-chip">
                      {indicator}
                    </span>
                  ))}
                  {entry.trustedStatus ? (
                    <span className="detail-chip detail-chip-safe">Trusted domain</span>
                  ) : null}
                  <InteractiveSurface
                    as="button"
                    type="button"
                    className="text-link detail-link button-inline"
                    preset="button"
                    inlineContent
                    onClick={() => handleTrustSite(entry)}
                  >
                    Trust site
                  </InteractiveSurface>
                  <InteractiveSurface
                    as="button"
                    type="button"
                    className="text-link detail-link button-inline"
                    preset="button"
                    inlineContent
                    onClick={() => handleFalsePositive(entry)}
                  >
                    Mark false positive
                  </InteractiveSurface>
                  <InteractiveSurface
                    as={Link}
                    to={`/threat-details/${entry.id}`}
                    className="text-link detail-link"
                    preset="button"
                    inlineContent
                  >
                    Open full threat report
                  </InteractiveSurface>
                </div>
              </InteractiveSurface>
            ))}
          {!loading && !scans.length ? (
            <EmptyState
              title="No scan records matched"
              description="Try a different filter or scan a site through the extension to populate the incident log."
            />
          ) : null}
        </div>
      </GlassCard>
      {error ? <p className="support-copy page-message">{error}</p> : null}
    </div>
  );
}
