import { Link } from 'react-router-dom';
import AnimatedList from './AnimatedList';
import { InteractiveSurface } from './InteractiveSurface';
import { ThreatBadge } from './ThreatBadge';

export function AlertFeed({ items }) {
  return (
    <AnimatedList
      items={items}
      className="alert-feed-list"
      itemClassName="alert-feed-item"
      showGradients={items.length > 3}
      displayScrollbar={items.length > 4}
      enableArrowNavigation
      renderItem={(alert, { isSelected }) => (
        <InteractiveSurface
          as="article"
          className={`alert-row ${isSelected ? 'is-selected' : ''}`.trim()}
          preset="row"
          borderGlow
          spotlight
          ripple={Boolean(alert.id)}
          spotlightRadius={240}
        >
          <div className="alert-pulse" />
          <div className="alert-copy">
            <div className="alert-head">
              <h4>{alert.title}</h4>
              <ThreatBadge tone={alert.severity}>{alert.severity}</ThreatBadge>
            </div>
            <p>{alert.detail}</p>
            <div className="alert-meta">
              <span>{alert.url}</span>
              <span>{new Date(alert.time).toLocaleString()}</span>
              {alert.id ? (
                <Link
                  to={`/threat-details/${alert.id}`}
                  className="text-link"
                  onClick={(event) => event.stopPropagation()}
                >
                  Open report
                </Link>
              ) : null}
            </div>
          </div>
        </InteractiveSurface>
      )}
    />
  );
}
