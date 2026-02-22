import React from 'react';
import type { PlanDay } from '../../types';
import { ACTIVITY_COLORS, ACTIVITY_LABELS } from '../../types';

interface PlanPreviewProps {
  weeks: PlanDay[][];   // grouped by week; each inner array = 7 days (Mon-Sun)
  maxWeeks?: number;
}

const DOW_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function PlanPreview({ weeks, maxWeeks = 6 }: PlanPreviewProps) {
  const display = weeks.slice(0, maxWeeks);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="text-left text-gray-400 dark:text-gray-500 font-medium pr-2 w-8">Wk</th>
            {DOW_LABELS.map((d, i) => (
              <th key={i} className="text-center text-gray-400 dark:text-gray-500 font-medium w-9">{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {display.map((week, wi) => (
            <tr key={wi} className="h-8">
              <td className="text-gray-400 dark:text-gray-500 pr-2 text-right">{wi + 1}</td>
              {week.map((day, di) => {
                const color = ACTIVITY_COLORS[day.activity_type];
                const isRest = day.activity_type === 'rest';
                return (
                  <td key={di} className="text-center py-0.5 px-0.5">
                    <div
                      className="mx-auto w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: color + '25' }}
                      title={ACTIVITY_LABELS[day.activity_type] + (day.distance_value ? ` · ${day.distance_value}mi` : '')}
                    >
                      {isRest ? (
                        <span className="text-gray-300">—</span>
                      ) : (
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
          {weeks.length > maxWeeks && (
            <tr>
              <td colSpan={8} className="text-center text-gray-400 dark:text-gray-500 pt-1">
                + {weeks.length - maxWeeks} more weeks
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

