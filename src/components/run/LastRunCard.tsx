import { useEffect, useState } from 'react';
import type { Run, RoutePoint } from '../../types';
import { RUN_TYPE_LABELS } from '../../types';
import { Card } from '../ui/Card';
import { MetricChip } from '../ui/MetricChip';
import { RunRouteMap } from './RunRouteMap';
import { formatDistance, formatDuration, formatPace, calcPaceSeconds } from '../../utils/paceUtils';
import { formatLong } from '../../utils/dateUtils';
import { useDb } from '../../contexts/DatabaseContext';
import { getRouteForRun } from '../../services/runService';

interface LastRunCardProps {
  run: Run;
  units: 'mi' | 'km';
  onClick: () => void;
}

export function LastRunCard({ run, units, onClick }: LastRunCardProps) {
  const db = useDb();
  const [routePoints, setRoutePoints] = useState<RoutePoint[] | null>(null);

  useEffect(() => {
    if (!run.has_route) {
      setRoutePoints(null);
      return;
    }
    getRouteForRun(db, run.id).then(setRoutePoints);
  }, [db, run.id, run.has_route]);

  const pace = formatPace(calcPaceSeconds(run.distance_value, run.duration_seconds, run.distance_unit), units);

  return (
    <Card padding={false} onClick={onClick} className="shadow-elevated">
      <div className="p-4 pb-2">
        <p className="text-xs font-medium text-ink-muted dark:text-ink-dark-muted uppercase tracking-wide">
          {RUN_TYPE_LABELS[run.run_type]}
        </p>
        <p className="text-sm text-ink-secondary dark:text-ink-dark-secondary mt-0.5">
          {formatLong(run.date)}
        </p>
      </div>
      {routePoints && routePoints.length >= 2 ? (
        <RunRouteMap points={routePoints} className="h-40 rounded-none" interactive={false} />
      ) : (
        <div className="h-24 bg-gradient-to-r from-primary-50 to-indigo-50 dark:from-primary-900/20 dark:to-indigo-900/20" />
      )}
      <div className="p-4 flex gap-6 border-t border-border/60 dark:border-border-dark/60">
        <MetricChip label={units} value={formatDistance(run.distance_value, units)} />
        <MetricChip label="pace" value={pace} />
        <MetricChip label="time" value={formatDuration(run.duration_seconds)} />
      </div>
    </Card>
  );
}
