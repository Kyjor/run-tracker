import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

interface MileageChartProps {
  data: { week: string; miles: number }[];
  unit: 'mi' | 'km';
}

export function MileageChart({ data, unit }: MileageChartProps) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
        <XAxis
          dataKey="week"
          tick={{ fontSize: 10, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
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
          formatter={(v: number) => [`${v} ${unit}`, 'Mileage']}
        />
        <Line
          type="monotone"
          dataKey="miles"
          stroke="#3b82f6"
          strokeWidth={2.5}
          dot={{ fill: '#3b82f6', r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

