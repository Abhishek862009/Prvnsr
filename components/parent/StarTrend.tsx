import { formatDateShort } from "@/server/lib/dates";
import type { TrendPoint } from "@/server/lib/parent-report";

/** Simple bar trend: one bar per day, height = stars out of 5. Unrated days show a small grey tick. */
export default function StarTrend({ points }: { points: TrendPoint[] }) {
  if (points.length === 0) return null;
  const W = 600;
  const H = 120;
  const slot = W / points.length;
  const bar = Math.max(4, slot - 4);
  const rated = points.filter((p) => p.stars !== null).length;
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H + 4}`} className="h-auto w-full" role="img" aria-label={`Star trend, ${rated} rated days out of ${points.length}`}>
        <line x1="0" y1={H} x2={W} y2={H} stroke="#d6d3d1" />
        {points.map((p, i) => {
          const x = i * slot + (slot - bar) / 2;
          return p.stars === null ? (
            <rect key={p.date} x={x} y={H - 3} width={bar} height="3" fill="#d6d3d1" />
          ) : (
            <rect key={p.date} x={x} y={H - (p.stars / 5) * H} width={bar} height={(p.stars / 5) * H} rx="2" fill="#f59e0b" />
          );
        })}
      </svg>
      <figcaption className="mt-1 flex justify-between text-xs text-stone-500">
        <span>{formatDateShort(points[0]?.date ?? "")}</span>
        <span>{formatDateShort(points[points.length - 1]?.date ?? "")}</span>
      </figcaption>
    </figure>
  );
}
