export function LoadingPanel({ label = 'Loading secure telemetry...' }) {
  return (
    <div className="loading-panel">
      <span className="loading-spinner" />
      <p>{label}</p>
    </div>
  );
}
