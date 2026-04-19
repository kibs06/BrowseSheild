import { Link } from 'react-router-dom';
import { InteractiveSurface } from './InteractiveSurface';
import { buildFlaggedDomainItems } from '../lib/analytics/dashboardSectionData';

function SparklineBars({ values }) {
  const maxValue = Math.max(1, ...values);

  return (
    <div className="domain-sparkline" aria-hidden="true">
      {values.map((value, index) => (
        <span
          key={`${value}-${index}`}
          className="domain-sparkline__bar"
          style={{ height: `${Math.max(18, (value / maxValue) * 100)}%` }}
        />
      ))}
    </div>
  );
}

export function FlaggedDomainsCard({ scans, range, falsePositiveCount }) {
  const items = buildFlaggedDomainItems(scans, range);

  return (
    <>
      <div className="card-topline analytics-card-topline">
        <div>
          <span className="panel-label">Top flagged domains</span>
          <p className="analytics-panel-subtitle">
            Ranked domains that repeatedly surface as elevated risk in the selected window.
          </p>
        </div>
        <div className="domains-card-total">{falsePositiveCount} false positives</div>
      </div>
      {items.length ? (
        <div className="flagged-domain-list">
          {items.map((item) => (
            <InteractiveSurface
              key={item.domain}
              as={Link}
              to={item.href}
              className="flagged-domain-row"
              preset="row"
              borderGlow
              spotlight
              ripple
              spotlightRadius={220}
            >
              <div className="flagged-domain-row__rank">#{item.rank}</div>
              <div className="flagged-domain-row__copy">
                <strong>{item.domain}</strong>
                <span>Last seen {item.lastSeenLabel}</span>
              </div>
              <SparklineBars values={item.sparkline} />
              <div className="flagged-domain-row__meta">
                <div className="flagged-domain-row__count">{item.count} flags</div>
                <div className={`flagged-domain-row__badge tone-${item.riskLevel.toLowerCase()}`}>
                  {item.riskLevel}
                </div>
              </div>
            </InteractiveSurface>
          ))}
        </div>
      ) : (
        <div className="analytics-empty-state analytics-empty-state--domains">
          <strong>No flagged-domain trend yet</strong>
          <p>
            Once repeated high-risk detections appear, BrowseShield will rank them here with counts and latest activity.
          </p>
        </div>
      )}
    </>
  );
}
