import type { HeroVisual } from '../../types';

export function HeroVisualView({ hero }: { hero: HeroVisual }) {
  return (
    <div className="bg-gray-950 text-white px-4 py-4">
      <p className="text-[11px] uppercase tracking-wider text-white/60">{hero.title}</p>
      <p className="text-3xl font-semibold tracking-tight mt-1">
        {hero.headline}
        {hero.caption && hero.series == null && hero.slices == null && (
          <span className="text-base font-medium text-white/70 ml-2">{hero.caption}</span>
        )}
      </p>
      {hero.series && hero.series.length >= 2 && (
        <Sparkline series={hero.series} invert={hero.kind === 'pace_series'} />
      )}
      {hero.slices && hero.slices.length > 0 && <ZonePie slices={hero.slices} />}
      {hero.caption && (hero.series || hero.slices) && (
        <p className="text-[11px] text-white/50 mt-2">{hero.caption}</p>
      )}
    </div>
  );
}

function Sparkline({ series, invert = false }: { series: { t: number; y: number }[]; invert?: boolean }) {
  const ys = series.map(point => point.y);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const span = max - min || 1;
  const width = 320;
  const height = 72;
  const coords = series.map((point, index) => {
    const plotted = invert ? max + min - point.y : point.y;
    const x = series.length === 1 ? 0 : (index / (series.length - 1)) * width;
    const y = height - ((plotted - min) / span) * (height - 8) - 4;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-16 mt-3" preserveAspectRatio="none">
      <polyline fill="none" stroke="#fb923c" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" points={coords.join(' ')} />
    </svg>
  );
}

function ZonePie({ slices }: { slices: { label: string; seconds: number; color: string }[] }) {
  const total = slices.reduce((sum, slice) => sum + slice.seconds, 0) || 1;
  let cursor = 0;
  const stops = slices.map(slice => {
    const start = cursor;
    cursor += (slice.seconds / total) * 100;
    return `${slice.color} ${start}% ${cursor}%`;
  });
  return (
    <div className="flex items-center gap-4 mt-3">
      <div
        className="w-16 h-16 rounded-full shrink-0"
        style={{ background: `conic-gradient(${stops.join(', ')})` }}
      />
      <ul className="flex flex-col gap-1 min-w-0">
        {slices.map(slice => (
          <li key={slice.label} className="flex items-center gap-2 text-xs text-white/80">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: slice.color }} />
            <span className="truncate">{slice.label}</span>
            <span className="tabular-nums text-white/50">{Math.round((slice.seconds / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
