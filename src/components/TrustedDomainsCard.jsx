import { Link } from 'react-router-dom';
import AnimatedList from './AnimatedList';
import { DomainAvatar } from './DomainAvatar';
import { InteractiveSurface } from './InteractiveSurface';
import { buildTrustedDomainItems } from '../lib/analytics/dashboardSectionData';

export function TrustedDomainsCard({ trustedSites, scans, trustedDomainsCount }) {
  const items = buildTrustedDomainItems(trustedSites, scans);

  return (
    <>
      <div className="card-topline analytics-card-topline">
        <div>
          <span className="panel-label">Trusted domains</span>
          <p className="analytics-panel-subtitle">
            Approved sites remain easy to revisit, audit, and verify.
          </p>
        </div>
        <div className="trusted-card-total">{trustedDomainsCount} trusted</div>
      </div>
      <AnimatedList
        items={items.slice(0, 6)}
        className="trusted-domain-list-shell"
        showGradients={items.length > 3}
        displayScrollbar={items.length > 4}
        enableArrowNavigation
        renderItem={(site, { isSelected }) => {
          const surfaceProps = site.isInternal
            ? { as: Link, to: site.href }
            : { as: 'a', href: site.href, target: '_blank', rel: 'noreferrer' };

          return (
            <InteractiveSurface
              {...surfaceProps}
              className={`trusted-domain-row ${isSelected ? 'is-selected' : ''}`.trim()}
              preset="row"
              borderGlow
              spotlight
              ripple
              spotlightRadius={220}
            >
              <DomainAvatar domain={site.domain} src={site.faviconUrl} />
              <div className="trusted-domain-row__copy">
                <strong>{site.domain}</strong>
                <span>{site.reason}</span>
                <small>{site.sourceLabel} | Trusted {site.dateLabel}</small>
              </div>
              <div className="trusted-domain-row__meta">
                <span className={`trusted-domain-row__pill tone-${site.riskLevel.toLowerCase()}`}>
                  {site.isInternal ? 'Report' : 'Open'}
                </span>
              </div>
            </InteractiveSurface>
          );
        }}
      />
    </>
  );
}
