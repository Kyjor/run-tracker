import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { DistanceUnit, Run, RunType } from '../../types';
import { RUN_TYPE_LABELS } from '../../types';
import { Card } from '../ui/Card';
import { useDb } from '../../contexts/DatabaseContext';
import { getRunsByDateRange, getRuns } from '../../services/runService';
import { calcPaceSeconds, convertDistance, formatPace } from '../../utils/paceUtils';
import { formatShort } from '../../utils/dateUtils';

type Metric = 'pace' | 'avg_heart_rate' | 'cadence' | 'effort';

const METRICS: { id: Metric; label: string; lowerIsBetter: boolean }[] = [
  { id: 'pace', label: 'Pace', lowerIsBetter: true },
  { id: 'avg_heart_rate', label: 'Heart rate', lowerIsBetter: true },
  { id: 'cadence', label: 'Cadence', lowerIsBetter: false },
  { id: 'effort', label: 'Effort', lowerIsBetter: true },
];

interface ProgressCompareProps {
  unit: DistanceUnit;
  start?: string;
  end?: string;
}

export function ProgressCompare({ unit, start, end }: ProgressCompareProps) {
  const db = useDb();
  const [runs, setRuns] = useState<Run[]>([]);
  const [metric, setMetric] = useState<Metric>('pace');
  const [runType, setRunType] = useState<RunType | 'all'>('all');
  const [band, setBand] = useState<number | 'all'>('all');

  useEffect(() => {
    const load = start && end ? getRunsByDateRange(db, start, end) : getRuns(db, 500);
    void load.then(setRuns);
  }, [db, start, end]);

  const types = useMemo(() => {
    const present = new Set(runs.map(run => run.run_type));
    return (Object.keys(RUN_TYPE_LABELS) as RunType[]).filter(type => present.has(type));
  }, [runs]);

  const bands = useMemo(() => {
    const counts = new Map<number, number>();
    for (const run of runs) {
      if (runType !== 'all' && run.run_type !== runType) continue;
      const distance = convertDistance(run.distance_value, run.distance_unit, unit);
      const bucket = Math.floor(distance);
      counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
    }
    return [...counts.entries()]
      .filter(([, count]) => count >= 2)
      .sort((a, b) => a[0] - b[0])
      .map(([bucket]) => bucket);
  }, [runs, runType, unit]);

  const points = useMemo(() => {
    return runs
      .filter(run => runType === 'all' || run.run_type === runType)
      .filter(run => {
        if (band === 'all') return true;
        const distance = convertDistance(run.distance_value, run.distance_unit, unit);
        return distance >= band && distance < band + 1;
      })
      .map(run => ({ run, value: metricValue(run, metric, unit) }))
      .filter((point): point is { run: Run; value: number } => point.value != null && point.value > 0)
      .sort((a, b) => a.run.date.localeCompare(b.run.date))
      .map(point => ({
        label: formatShort(point.run.date),
        value: metric === 'pace' ? Math.round(point.value) : Math.round(point.value * 10) / 10,
      }));
  }, [runs, runType, band, metric, unit]);

  const summary = useMemo(() => describeTrend(points.map(point => point.value), metric, unit), [points, metric, unit]);
  const meta = METRICS.find(item => item.id === metric)!;

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-semibold text-gray-900 dark:text-white">Similar runs</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Same kind of run, close in distance, so the trend is your fitness and not a longer route.
        </p>
      </div>

      <ChipRow>
        {METRICS.map(item => (
          <Chip key={item.id} active={metric === item.id} onClick={() => setMetric(item.id)}>{item.label}</Chip>
        ))}
      </ChipRow>
      <ChipRow>
        <Chip active={runType === 'all'} onClick={() => { setRunType('all'); setBand('all'); }}>Any type</Chip>
        {types.map(type => (
          <Chip key={type} active={runType === type} onClick={() => { setRunType(type); setBand('all'); }}>
            {RUN_TYPE_LABELS[type]}
          </Chip>
        ))}
      </ChipRow>
      <ChipRow>
        <Chip active={band === 'all'} onClick={() => setBand('all')}>Any distance</Chip>
        {bands.map(bucket => (
          <Chip key={bucket} active={band === bucket} onClick={() => setBand(bucket)}>
            {bucket}–{bucket + 1} {unit}
          </Chip>
        ))}
      </ChipRow>

      {points.length < 2 ? (
        <p className="text-sm text-gray-400">Not enough matching runs in this range yet.</p>
      ) : (
        <>
          {summary && <p className="text-sm text-gray-800 dark:text-gray-100">{summary}</p>}
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={points} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.25} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                width={36}
                reversed={meta.lowerIsBetter && metric === 'pace'}
                tickFormatter={value => metric === 'pace' ? formatPace(value, unit).replace(/ \/.*$/, '') : String(value)}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 12, color: '#f9fafb', fontSize: 12 }}
                formatter={(value: number) => [metric === 'pace' ? formatPace(value, unit) : String(value), meta.label]}
              />
              <Line type="monotone" dataKey="value" stroke="#f97316" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </>
      )}
    </Card>
  );
}

function metricValue(run: Run, metric: Metric, unit: DistanceUnit): number | null {
  if (metric === 'pace') {
    const pace = calcPaceSeconds(convertDistance(run.distance_value, run.distance_unit, unit), run.duration_seconds, unit);
    return pace > 0 ? pace : null;
  }
  if (metric === 'avg_heart_rate') return run.avg_heart_rate;
  if (metric === 'cadence') return run.avg_cadence;
  return run.effort;
}

function describeTrend(values: number[], metric: Metric, unit: DistanceUnit): string | null {
  if (values.length < 4) return null;
  const sample = Math.max(2, Math.floor(values.length / 3));
  const early = average(values.slice(0, sample));
  const late = average(values.slice(-sample));
  const delta = late - early;
  const meta = METRICS.find(item => item.id === metric)!;
  const improved = meta.lowerIsBetter ? delta < 0 : delta > 0;
  if (Math.abs(delta) < (metric === 'pace' ? 2 : 0.4)) return 'About the same as your earlier matching runs.';
  const amount = Math.abs(Math.round(delta));
  if (metric === 'pace') return `${amount}s/${unit} ${improved ? 'faster' : 'slower'} than your earlier matching runs.`;
  if (metric === 'avg_heart_rate') return `${amount} bpm ${improved ? 'lower' : 'higher'} than your earlier matching runs.`;
  if (metric === 'cadence') return `${amount} spm ${improved ? 'higher' : 'lower'} than your earlier matching runs.`;
  return `${amount} effort ${improved ? 'easier' : 'harder'} than your earlier matching runs.`;
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function ChipRow({ children }: { children: ReactNode }) {
  return <div className="flex gap-2 overflow-x-auto pb-1">{children}</div>;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 text-xs px-3 py-1.5 rounded-full ${active ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
    >
      {children}
    </button>
  );
}
