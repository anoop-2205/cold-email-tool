export default function MatchBadge({ score }) {
  if (score === null || score === undefined) {
    return <span className="match-badge match-pending">unscored</span>;
  }
  const tier = score >= 80 ? "high" : score >= 40 ? "mid" : "low";
  return <span className={`match-badge match-${tier}`}>{score}</span>;
}
