import type { Run, HRZones } from '../../types';
import { useSettings } from '../../contexts/SettingsContext';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseHRZones(json: string | null): HRZones | null {
  if (!json) return null;
  try { return JSON.parse(json) as HRZones; } catch { return null; }
}

function fmtBpm(v: number | null) {
  return v != null ? `${Math.round(v)} bpm` : '—';
}

function fmtDegC(v: number | null, showF = false) {
  if (v == null) return '—';
  if (showF) return `${Math.round(v * 9 / 5 + 32)}°F`;
  return `${Math.round(v)}°C`;
}

function fmtSeconds(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function fmtMeters(v: number | null, label: string) {
  if (v == null || v <= 0) return null;
  return `${Math.round(v)} m ${label}`;
}

function weatherEmoji(cond: string | null) {
  switch (cond) {
    case 'clear':  return '☀️';
    case 'cloudy': return '☁️';
    case 'foggy':  return '🌫️';
    case 'windy':  return '💨';
    case 'rain':   return '🌧️';
    case 'snow':   return '❄️';
    case 'storm':  return '⛈️';
    default:       return '🌡️';
  }
}

// ── Zone config ─────────────────────────────────────────────────────────────
// Percentages are expressed as fraction of max HR.
const ZONE_CONFIG = [
  { name: 'Recovery',  color: '#94a3b8', min: 0.00, max: 0.60 },
  { name: 'Easy',      color: '#34d399', min: 0.60, max: 0.70 },
  { name: 'Aerobic',   color: '#fbbf24', min: 0.70, max: 0.80 },
  { name: 'Threshold', color: '#fb923c', min: 0.80, max: 0.90 },
  { name: 'Max',       color: '#ef4444', min: 0.90, max: 1.00 },
] as const;

function formatZoneRangeLabel(idx: number, maxHrBpm: number): string {
  const z = ZONE_CONFIG[idx];
  const maxHr = maxHrBpm > 0 ? maxHrBpm : 190;

  const minBpm = Math.round(z.min * maxHr);
  const maxBpm = Math.round(z.max * maxHr);

  if (idx === 0) {
    return `${z.name} (<${maxBpm} bpm)`;
  }
  if (idx === ZONE_CONFIG.length - 1) {
    return `${z.name} (≥${minBpm} bpm)`;
  }
  return `${z.name} (${minBpm}–${maxBpm} bpm)`;
}

// ── Cadence insight ──────────────────────────────────────────────────────────
function cadenceInsight(spm: number | null): { label: string; color: string } | null {
  if (spm == null) return null;
  if (spm >= 175) return { label: 'Excellent (≥175 spm)', color: 'text-green-600 dark:text-green-400' };
  if (spm >= 165) return { label: 'Good (165-174 spm)', color: 'text-yellow-600 dark:text-yellow-400' };
  return { label: 'Improve (target 170+ spm)', color: 'text-orange-500 dark:text-orange-400' };
}

function gctInsight(ms: number | null): { label: string; color: string } | null {
  if (ms == null) return null;
  if (ms < 240) return { label: 'Excellent (<240ms)', color: 'text-green-600 dark:text-green-400' };
  if (ms < 290) return { label: 'Good (240-290ms)', color: 'text-yellow-600 dark:text-yellow-400' };
  return { label: 'Improve (>290ms)', color: 'text-orange-500 dark:text-orange-400' };
}

function voInsight(cm: number | null): { label: string; color: string } | null {
  if (cm == null) return null;
  if (cm < 7) return { label: 'Excellent (<7cm)', color: 'text-green-600 dark:text-green-400' };
  if (cm < 10) return { label: 'Good (7-10cm)', color: 'text-yellow-600 dark:text-yellow-400' };
  return { label: 'Reduce bounce (>10cm)', color: 'text-orange-500 dark:text-orange-400' };
}

function vo2Insight(val: number | null): { label: string; color: string } | null {
  if (val == null) return null;
  if (val >= 55) return { label: 'Superior', color: 'text-green-600 dark:text-green-400' };
  if (val >= 45) return { label: 'Excellent', color: 'text-blue-600 dark:text-blue-400' };
  if (val >= 38) return { label: 'Good', color: 'text-yellow-600 dark:text-yellow-400' };
  return { label: 'Fair', color: 'text-gray-500 dark:text-gray-400' };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MetricRow({
  label,
  value,
  insight,
  unit,
}: {
  label: string;
  value: string;
  insight?: { label: string; color: string } | null;
  unit?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <div className="flex flex-col items-end">
        <span className="text-sm font-semibold text-gray-900 dark:text-white">
          {value}{unit ? ` ${unit}` : ''}
        </span>
        {insight && (
          <span className={`text-xs ${insight.color}`}>{insight.label}</span>
        )}
      </div>
    </div>
  );
}

function SectionBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          {title}
        </h3>
      </div>
      <div className="px-4">{children}</div>
    </div>
  );
}

// ── Heart Rate Zones bar ────────────────────────────────────────────────────
function HRZonesBar({ zones, maxHrBpm }: { zones: HRZones; maxHrBpm: number }) {
  const total = zones.z1_seconds + zones.z2_seconds + zones.z3_seconds + zones.z4_seconds + zones.z5_seconds;
  if (total <= 0) return null;

  const zoneTimes = [
    zones.z1_seconds,
    zones.z2_seconds,
    zones.z3_seconds,
    zones.z4_seconds,
    zones.z5_seconds,
  ];

  return (
    <div className="py-3">
      {/* Stacked bar */}
      <div className="flex h-4 rounded-full overflow-hidden gap-0.5 mb-3">
        {zoneTimes.map((secs, i) => {
          const pct = (secs / total) * 100;
          if (pct < 0.5) return null;
          return (
            <div
              key={i}
              style={{ width: `${pct}%`, backgroundColor: ZONE_CONFIG[i].color }}
              title={`${formatZoneRangeLabel(i, maxHrBpm)} · ${fmtSeconds(secs)}`}
            />
          );
        })}
      </div>

      {/* Zone breakdown rows */}
      <div className="flex flex-col gap-1.5">
        {zoneTimes.map((secs, i) => {
          if (secs <= 0) return null;
          const pct = Math.round((secs / total) * 100);
          return (
            <div key={i} className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                style={{ backgroundColor: ZONE_CONFIG[i].color }}
              />
              <span className="text-xs text-gray-600 dark:text-gray-300 flex-1">
                {formatZoneRangeLabel(i, maxHrBpm)}
              </span>
              <span className="text-xs text-gray-400 w-10 text-right">{pct}%</span>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-200 w-12 text-right">
                {fmtSeconds(secs)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface RunMetricsDisplayProps {
  run: Run;
  /** Show in °F instead of °C */
  useFahrenheit?: boolean;
}

export function RunMetricsDisplay({ run, useFahrenheit = true }: RunMetricsDisplayProps) {
  const zones = parseHRZones(run.hr_zones);
  const hasHR = run.avg_heart_rate != null || run.max_heart_rate != null || zones != null;
  const hasForm = run.avg_cadence != null || run.avg_stride_length_meters != null
    || run.avg_ground_contact_time_ms != null || run.avg_vertical_oscillation_cm != null;
  const hasPower = run.avg_power_watts != null;
  const hasElevation = run.elevation_gain_meters != null || run.elevation_loss_meters != null;
  const hasEnv = run.temperature_celsius != null || run.humidity_percent != null || run.weather_condition != null;
  const hasVO2 = run.vo2_max != null;

  // Nothing to show — manual run with no extra data
  if (!hasHR && !hasForm && !hasPower && !hasElevation && !hasEnv && !hasVO2) {
    return null;
  }

  const { settings } = useSettings();
  const maxHrBpm = settings.max_heart_rate_bpm ?? 190;

  return (
    <div className="flex flex-col gap-3">

      {/* ── Heart Rate ─────────────────────────────────────────── */}
      {hasHR && (
        <SectionBox title="Heart Rate">
          {run.avg_heart_rate != null && (
            <MetricRow label="Average HR" value={fmtBpm(run.avg_heart_rate)} />
          )}
          {run.max_heart_rate != null && (
            <MetricRow label="Max HR" value={fmtBpm(run.max_heart_rate)} />
          )}
          {run.min_heart_rate != null && (
            <MetricRow label="Min HR" value={fmtBpm(run.min_heart_rate)} />
          )}
          {zones && <HRZonesBar zones={zones} maxHrBpm={maxHrBpm} />}
          {zones && (
            <p className="mt-1 mb-1 text-[11px] text-gray-400 dark:text-gray-500">
              Zone ranges are based on your max heart rate set in Settings ({maxHrBpm} bpm).
            </p>
          )}
        </SectionBox>
      )}

      {/* ── Running Form ───────────────────────────────────────── */}
      {hasForm && (
        <SectionBox title="Running Form">
          {run.avg_cadence != null && (
            <MetricRow
              label="Cadence"
              value={`${Math.round(run.avg_cadence)}`}
              unit="spm"
              insight={cadenceInsight(run.avg_cadence)}
            />
          )}
          {run.avg_stride_length_meters != null && (
            <MetricRow
              label="Stride Length"
              value={(run.avg_stride_length_meters * 100).toFixed(0)}
              unit="cm"
            />
          )}
          {run.avg_ground_contact_time_ms != null && (
            <MetricRow
              label="Ground Contact"
              value={Math.round(run.avg_ground_contact_time_ms).toString()}
              unit="ms"
              insight={gctInsight(run.avg_ground_contact_time_ms)}
            />
          )}
          {run.avg_vertical_oscillation_cm != null && (
            <MetricRow
              label="Vertical Oscillation"
              value={run.avg_vertical_oscillation_cm.toFixed(1)}
              unit="cm"
              insight={voInsight(run.avg_vertical_oscillation_cm)}
            />
          )}
        </SectionBox>
      )}

      {/* ── Power ─────────────────────────────────────────────── */}
      {hasPower && (
        <SectionBox title="Power">
          {run.avg_power_watts != null && (
            <MetricRow label="Average Power" value={`${Math.round(run.avg_power_watts)}`} unit="W" />
          )}
          {run.max_power_watts != null && (
            <MetricRow label="Peak Power" value={`${Math.round(run.max_power_watts)}`} unit="W" />
          )}
        </SectionBox>
      )}

      {/* ── Elevation ────────────────────────────────────────── */}
      {hasElevation && (
        <SectionBox title="Elevation">
          {fmtMeters(run.elevation_gain_meters, 'gained') && (
            <MetricRow
              label="Elevation Gain"
              value={`${Math.round(run.elevation_gain_meters!)} m`}
            />
          )}
          {fmtMeters(run.elevation_loss_meters, 'lost') && (
            <MetricRow
              label="Elevation Loss"
              value={`${Math.round(run.elevation_loss_meters!)} m`}
            />
          )}
        </SectionBox>
      )}

      {/* ── Environment ──────────────────────────────────────── */}
      {hasEnv && (
        <SectionBox title="Conditions">
          {run.weather_condition && (
            <MetricRow
              label="Weather"
              value={`${weatherEmoji(run.weather_condition)} ${run.weather_condition.charAt(0).toUpperCase() + run.weather_condition.slice(1)}`}
            />
          )}
          {run.temperature_celsius != null && (
            <MetricRow
              label="Temperature"
              value={fmtDegC(run.temperature_celsius, useFahrenheit)}
            />
          )}
          {run.humidity_percent != null && (
            <MetricRow
              label="Humidity"
              value={`${Math.round(run.humidity_percent)}%`}
            />
          )}
        </SectionBox>
      )}

      {/* ── Fitness Snapshot ────────────────────────────────── */}
      {hasVO2 && (
        <SectionBox title="Fitness Snapshot">
          <MetricRow
            label="VO₂ Max"
            value={`${run.vo2_max!.toFixed(1)}`}
            unit="mL/kg/min"
            insight={vo2Insight(run.vo2_max)}
          />
        </SectionBox>
      )}

      {/* ── Calories ─────────────────────────────────────────── */}
      {run.calories != null && (
        <SectionBox title="Energy">
          <MetricRow label="Calories Burned" value={`${Math.round(run.calories)}`} unit="kcal" />
        </SectionBox>
      )}
    </div>
  );
}

