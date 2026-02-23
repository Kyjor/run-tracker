import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { ACTIVITY_COLORS, RUN_TYPE_LABELS } from '../../types';

interface RunTypeChartProps {
  data: { type: string; miles: number }[];
  unit: 'mi' | 'km';
}

export function RunTypeChart({ data, unit }: RunTypeChartProps) {
  const labeled = data.map(d => ({
    ...d,
    label: RUN_TYPE_LABELS[d.type as keyof typeof RUN_TYPE_LABELS] ?? d.type,
    color: ACTIVITY_COLORS[d.type as keyof typeof ACTIVITY_COLORS] ?? '#9ca3af',
  }));

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={labeled} margin={{ top: 5, right: 5, bottom: 20, left: 0 }}>
        <XAxis
          dataKey="label"
          tick={{ fontSize: 9, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
          angle={-30}
          textAnchor="end"
        />
        <YAxis
          tick={{ fontSize: 10, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
          unit={unit}
          width={32}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1f2937',
            border: 'none',
            borderRadius: 12,
            color: '#f9fafb',
            fontSize: 12,
          }}
          formatter={(v: number) => [`${v} ${unit}`, 'Distance']}
        />
        <Bar dataKey="miles" radius={[6, 6, 0, 0]}>
          {labeled.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

