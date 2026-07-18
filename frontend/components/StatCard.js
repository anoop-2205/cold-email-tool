export default function StatCard({ label, value, sublabel }) {
  return (
    <div className="stat-card">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {sublabel ? <span className="stat-sublabel">{sublabel}</span> : null}
    </div>
  );
}
