import type { RoutePoint } from '../../types';

interface RunRouteMapProps {
  points: RoutePoint[];
  className?: string;
}

export function RunRouteMap({ points, className = '' }: RunRouteMapProps) {
  if (!points || points.length < 2) {
    return (
      <div className={['h-40 w-full rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center', className].join(' ')}>
        <span className="text-xs text-gray-400">Route data not available.</span>
      </div>
    );
  }

  let minLat = points[0].lat;
  let maxLat = points[0].lat;
  let minLng = points[0].lng;
  let maxLng = points[0].lng;

  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }

  const padding = 0.05;
  const dLat = maxLat - minLat || 1e-6;
  const dLng = maxLng - minLng || 1e-6;

  const normPoints = points.map((p) => {
    const x = ((p.lng - minLng) / dLng) * (100 - padding * 2 * 100) + padding * 100;
    const y = (1 - (p.lat - minLat) / dLat) * (100 - padding * 2 * 100) + padding * 100;
    return { x, y };
  });

  const polyPoints = normPoints.map(p => `${p.x},${p.y}`).join(' ');
  const start = normPoints[0];
  const end = normPoints[normPoints.length - 1];

  return (
    <div className={['h-48 w-full rounded-2xl overflow-hidden bg-gray-900/5 dark:bg-gray-800', className].join(' ')}>
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <defs>
          <linearGradient id="runRouteStroke" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#0ea5e9" />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width="100" height="100" fill="url(#routeBg)" fillOpacity="0" />

        <polyline
          points={polyPoints}
          fill="none"
          stroke="url(#runRouteStroke)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Start point */}
        <circle cx={start.x} cy={start.y} r={2.5} fill="#22c55e" />
        {/* End point */}
        <circle cx={end.x} cy={end.y} r={2.5} fill="#0ea5e9" />
      </svg>
    </div>
  );
}


