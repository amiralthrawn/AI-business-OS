// A small, honest trend indicator -- shows DIRECTION only (no axis, no
// gridlines, no implied intermediate precision), for values where only the
// endpoints are real. `points` are plotted evenly across the width.
export default function Sparkline({
  points,
  tone = "text-text-soft",
  width = 74,
  height = 26,
}: {
  points: number[];
  tone?: string;
  width?: number;
  height?: number;
}) {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1);

  const coords = points.map((p, i) => {
    const x = i * step;
    const y = height - ((p - min) / range) * (height - 4) - 2;
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  });

  const d = `M ${coords.join(" L ")}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={tone} fill="none">
      <path d={d} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
