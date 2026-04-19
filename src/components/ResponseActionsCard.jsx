import { ResponseActionsChart } from './ResponseActionsChart';
import { buildResponseActionItems } from '../lib/analytics/dashboardSectionData';

export function ResponseActionsCard({ scans, actions, feedback, range }) {
  const actionItems = buildResponseActionItems(scans, actions, feedback, range);
  const total = actionItems.reduce((sum, item) => sum + item.value, 0);

  return (
    <>
      <div className="card-topline analytics-card-topline">
        <div>
          <span className="panel-label">Response actions</span>
          <p className="analytics-panel-subtitle">
            Understand what users actually did after BrowseShield raised the warning.
          </p>
        </div>
        <div className="response-actions-total">{total} logged</div>
      </div>
      {total ? (
        <ResponseActionsChart items={actionItems} />
      ) : (
        <div className="analytics-empty-state">
          <strong>No response actions yet</strong>
          <p>Warning flows, report views, trusted-site approvals, and false-positive feedback will surface here.</p>
        </div>
      )}
    </>
  );
}
