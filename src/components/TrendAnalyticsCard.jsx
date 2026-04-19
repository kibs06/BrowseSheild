import { AnalyticsLineChart } from './AnalyticsLineChart';
import { TimeRangeSelector } from './TimeRangeSelector';
import { ANALYTICS_RANGE_OPTIONS, buildTrendSeries, filterItemsByRange } from '../lib/analytics/dashboardSectionData';

function formatRangeTitle(range) {
  return ANALYTICS_RANGE_OPTIONS.find((option) => option.key === range)?.label ?? '7D';
}

export function TrendAnalyticsCard({ scans, analytics, range, onRangeChange }) {
  const trendSeries = buildTrendSeries(scans, range);
  const filteredScans = filterItemsByRange(scans, range, (scan) => scan.scannedAt);
  const filteredHighRisk = filteredScans.filter((scan) => ['High', 'Critical'].includes(scan.riskLevel));
  const averageRisk = filteredScans.length
    ? Math.round(filteredScans.reduce((sum, scan) => sum + (scan.riskScore ?? 0), 0) / filteredScans.length)
    : 0;
  const chartTitle = `${formatRangeTitle(range)} signal activity`;

  return (
    <>
      <div className="card-topline analytics-card-topline">
        <div>
          <span className="panel-label">Trend analytics</span>
          <p className="analytics-panel-subtitle">
            Clean visibility into scan volume, flagged activity, and risk posture over time.
          </p>
        </div>
        <TimeRangeSelector options={ANALYTICS_RANGE_OPTIONS} value={range} onChange={onRangeChange} />
      </div>
      <div className="summary-metrics summary-metrics--analytics">
        <div className="summary-metric">
          <span className="meta-label">Scans today</span>
          <strong>{analytics.scansToday}</strong>
          <small>Live operational intake</small>
        </div>
        <div className="summary-metric">
          <span className="meta-label">Flagged today</span>
          <strong>{analytics.flaggedToday}</strong>
          <small>High and critical detections</small>
        </div>
        <div className="summary-metric">
          <span className="meta-label">High risk this week</span>
          <strong>{analytics.highRiskThisWeek}</strong>
          <small>Escalated review candidates</small>
        </div>
        <div className="summary-metric">
          <span className="meta-label">Top category</span>
          <strong>{analytics.mostCommonThreatCategory}</strong>
          <small>{averageRisk} avg. risk in {formatRangeTitle(range)}</small>
        </div>
      </div>
      <div className="analytics-chart-shell">
        <div className="analytics-chart-shell__header">
          <div>
            <strong>{chartTitle}</strong>
            <span>{filteredHighRisk.length} flagged detections in the selected window</span>
          </div>
        </div>
        <AnalyticsLineChart data={trendSeries} />
      </div>
    </>
  );
}
