import type Database from '@tauri-apps/plugin-sql';
import FitParser from 'fit-file-parser';
import { format } from 'date-fns';
import type {
  DistanceUnit,
  FitImportPreview,
  FitImportRecord,
  FitImportResult,
  RoutePoint,
  Run,
  RunType,
} from '../types';
import { createRun } from './runService';
import { generateId } from '../utils/generateId';
import { publishFeedActivity } from './socialService';
import { syncToCloud } from './syncService';

const FIT_ROUTE_LIMIT = 1200;

type JsonObject = Record<string, unknown>;

export interface PendingFitFilePayload {
  file_name: string;
  source_path: string | null;
  base64_data: string;
}

export async function parseFitFile(file: File): Promise<FitImportPreview[]> {
  const buffer = await file.arrayBuffer();
  return parseFitArrayBuffer(buffer, file.name, null);
}

export async function parsePendingFitPayload(payload: PendingFitFilePayload): Promise<FitImportPreview[]> {
  const bytes = decodeBase64(payload.base64_data);
  return parseFitArrayBuffer(bytes.buffer, payload.file_name, payload.source_path);
}

export async function parseFitArrayBuffer(
  buffer: ArrayBuffer,
  fileName: string,
  sourcePath: string | null,
): Promise<FitImportPreview[]> {
  const parser = new FitParser({
    force: true,
    mode: 'both',
    speedUnit: 'm/s',
    lengthUnit: 'm',
    temperatureUnit: 'celsius',
    elapsedRecordField: true,
  });

  const parsedUnknown = await parser.parseAsync(new Uint8Array(buffer));
  const parsed = toObject(parsedUnknown);
  const rootRecords = toObjectArray(parsed.records);
  const rootLaps = toObjectArray(parsed.laps);
  const sessions = toObjectArray(parsed.sessions);
  const sessionList = sessions.length > 0 ? sessions : [parsed];
  const previews = sessionList.map((session, index) =>
    buildPreviewFromSession({
      session,
      rootRecords,
      rootLaps,
      parsed,
      fileName,
      sourcePath,
      index,
    }),
  );
  const meaningful = previews.filter(preview =>
    (preview.total_distance_meters ?? 0) > 0
    || (preview.total_timer_seconds ?? preview.total_elapsed_seconds ?? 0) > 0
    || preview.records_count > 0,
  );
  if (meaningful.length === 0) {
    throw new Error('This FIT file does not contain importable workout data.');
  }
  return meaningful;
}

export async function annotateFitDuplicates(
  db: Database,
  previews: FitImportPreview[],
  units: DistanceUnit,
): Promise<FitImportPreview[]> {
  const annotated: FitImportPreview[] = [];
  for (const preview of previews) {
    const duplicate_of_run_id = await findDuplicateRunId(db, preview, units);
    annotated.push({ ...preview, duplicate_of_run_id });
  }
  return annotated;
}

export async function importFitWorkouts(
  db: Database,
  previews: FitImportPreview[],
  units: DistanceUnit,
  maxHeartRateBpm = 190,
): Promise<FitImportResult[]> {
  const results: FitImportResult[] = [];
  for (const preview of previews) {
    const duplicateId =
      preview.duplicate_of_run_id ?? (await findDuplicateRunId(db, preview, units));
    if (duplicateId) {
      results.push({
        preview_id: preview.id,
        status: 'skipped_duplicate',
        message: 'Duplicate workout already exists.',
      });
      continue;
    }

    try {
      const run = await createRun(db, {
        date: preview.started_at,
        distance_value: metersToUnit(preview.total_distance_meters ?? 0, units),
        distance_unit: units,
        duration_seconds: Math.round(preview.total_timer_seconds ?? preview.total_elapsed_seconds ?? 0),
        run_type: inferRunType(preview),
        notes: buildFitNotes(preview),
        source: 'fit',
        avg_heart_rate: preview.avg_heart_rate,
        max_heart_rate: preview.max_heart_rate,
        min_heart_rate: getMinHeartRate(preview.fit_records),
        hr_zones: buildHrZonesJson(preview.fit_records, maxHeartRateBpm),
        avg_cadence: preview.avg_cadence,
        avg_power_watts: preview.avg_power_watts,
        max_power_watts: preview.max_power_watts,
        elevation_gain_meters: preview.elevation_gain_meters,
        elevation_loss_meters: preview.elevation_loss_meters,
        vo2_max: preview.vo2_max,
        temperature_celsius: preview.temperature_celsius,
        calories: preview.calories,
        has_route: preview.route_points.length > 1 ? 1 : 0,
      });

      if (preview.route_points.length > 1) {
        await db.execute(
          'INSERT INTO run_routes (id, run_id, points_json, created_at) VALUES ($1, $2, $3, $4)',
          [generateId(), run.id, JSON.stringify(preview.route_points), new Date().toISOString()],
        );
      }

      await db.execute(
        `INSERT INTO fit_imports (id, run_id, file_name, source_path, parsed_json, summary_json, created_at, sync_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'local')`,
        [
          generateId(),
          run.id,
          preview.file_name,
          preview.source_path,
          JSON.stringify(preview.raw_payload),
          JSON.stringify(preview.raw_summary),
          new Date().toISOString(),
        ],
      );

      await publishFeedActivity('run_completed', {
        distance: run.distance_value,
        unit: run.distance_unit,
        duration: run.duration_seconds,
        run_type: run.run_type,
        run_id: run.id,
        run_date: format(new Date(run.date), 'yyyy-MM-dd'),
      });

      syncToCloud(db).catch(() => {});

      results.push({
        preview_id: preview.id,
        run_id: run.id,
        status: 'imported',
      });
    } catch (error) {
      results.push({
        preview_id: preview.id,
        status: 'failed',
        message: error instanceof Error ? error.message : 'Unknown import error',
      });
    }
  }

  return results;
}

async function findDuplicateRunId(
  db: Database,
  preview: FitImportPreview,
  units: DistanceUnit,
): Promise<string | null> {
  if (!preview.started_at || !preview.total_distance_meters || !preview.total_timer_seconds) {
    return null;
  }

  const date = preview.started_at.slice(0, 10);
  const existing = await db.select<Run[]>(
    "SELECT id, distance_value, distance_unit, duration_seconds, date, source FROM runs WHERE substr(date, 1, 10) = $1",
    [date],
  );
  const previewDistance = metersToUnit(preview.total_distance_meters, units);
  const previewDuration = preview.total_timer_seconds;

  for (const run of existing) {
    const runDistance = run.distance_unit === units
      ? run.distance_value
      : convertDistanceUnits(run.distance_value, run.distance_unit, units);
    const distanceDelta = Math.abs(runDistance - previewDistance);
    const durationDelta = Math.abs(run.duration_seconds - previewDuration);
    if (distanceDelta <= (units === 'mi' ? 0.08 : 0.12) && durationDelta <= 120) {
      return run.id;
    }
  }
  return null;
}

function buildPreviewFromSession(args: {
  session: JsonObject;
  rootRecords: JsonObject[];
  rootLaps: JsonObject[];
  parsed: JsonObject;
  fileName: string;
  sourcePath: string | null;
  index: number;
}): FitImportPreview {
  const { session, rootRecords, rootLaps, parsed, fileName, sourcePath, index } = args;
  const sessionRecords = toObjectArray(session.records);
  const sessionLaps = toObjectArray(session.laps);
  const records = sessionRecords.length > 0 ? sessionRecords : rootRecords;
  const laps = sessionLaps.length > 0 ? sessionLaps : rootLaps;

  const startedAt = parseDateIso(session.start_time) ?? parseDateIso(firstRecordTimestamp(records)) ?? new Date().toISOString();
  const endedAt = parseDateIso(session.timestamp) ?? parseDateIso(lastRecordTimestamp(records));
  const routePoints = buildRoutePoints(records);
  const fitRecords = buildFitRecords(records);

  const totalDistanceMeters = numOrNull(session.total_distance);
  const totalElapsedSeconds = numOrNull(session.total_elapsed_time);
  const totalTimerSeconds = numOrNull(session.total_timer_time) ?? totalElapsedSeconds;
  const avgHeartRate = numOrNull(session.avg_heart_rate);
  const maxHeartRate = numOrNull(session.max_heart_rate);
  const avgCadence = numOrNull(session.avg_cadence);
  const avgPowerWatts = numOrNull(session.avg_power);
  const maxPowerWatts = numOrNull(session.max_power);
  const elevationGainMeters = numOrNull(session.total_ascent);
  const elevationLossMeters = numOrNull(session.total_descent);
  const calories = numOrNull(session.total_calories);
  const vo2Max = numOrNull(session.enhanced_avg_respiration_rate);
  const temperatureCelsius = numOrNull(session.avg_temperature);
  const sport = strOrFallback(session.sport, 'running');
  const subSport = strOrNull(session.sub_sport);

  const raw_summary: Record<string, unknown> = {
    session_index: index,
    started_at: startedAt,
    ended_at: endedAt,
    sport,
    sub_sport: subSport,
    total_distance_meters: totalDistanceMeters,
    total_elapsed_seconds: totalElapsedSeconds,
    total_timer_seconds: totalTimerSeconds,
    calories,
    avg_heart_rate: avgHeartRate,
    max_heart_rate: maxHeartRate,
    avg_cadence: avgCadence,
    avg_power_watts: avgPowerWatts,
    max_power_watts: maxPowerWatts,
    elevation_gain_meters: elevationGainMeters,
    elevation_loss_meters: elevationLossMeters,
    vo2_max: vo2Max,
    records_count: records.length,
    laps_count: laps.length,
    route_points_count: routePoints.length,
  };

  return {
    id: generateId(),
    file_name: fileName,
    source_path: sourcePath,
    started_at: startedAt,
    ended_at: endedAt,
    sport,
    sub_sport: subSport,
    total_distance_meters: totalDistanceMeters,
    total_elapsed_seconds: totalElapsedSeconds,
    total_timer_seconds: totalTimerSeconds,
    calories,
    avg_heart_rate: avgHeartRate,
    max_heart_rate: maxHeartRate,
    avg_cadence: avgCadence,
    avg_power_watts: avgPowerWatts,
    max_power_watts: maxPowerWatts,
    elevation_gain_meters: elevationGainMeters,
    elevation_loss_meters: elevationLossMeters,
    vo2_max: vo2Max,
    temperature_celsius: temperatureCelsius,
    records_count: records.length,
    laps_count: laps.length,
    has_route: routePoints.length > 1,
    route_points: routePoints,
    fit_records: fitRecords,
    metrics: buildMetrics(raw_summary),
    raw_payload: parsed,
    raw_summary,
    duplicate_of_run_id: null,
  };
}

function inferRunType(preview: FitImportPreview): RunType {
  const sport = preview.sport.toLowerCase();
  if (sport.includes('walking')) return 'easy_run';
  if (sport.includes('hiking')) return 'long_run';

  const distanceMeters = preview.total_distance_meters ?? 0;
  const duration = preview.total_timer_seconds ?? preview.total_elapsed_seconds ?? 0;
  if (distanceMeters <= 0 || duration <= 0) return 'easy_run';

  const paceSecPerKm = duration / (distanceMeters / 1000);
  if (paceSecPerKm < 260) return 'intervals';
  if (paceSecPerKm < 300) return 'tempo_run';
  if (paceSecPerKm > 390) return 'long_run';
  return 'easy_run';
}

function buildHrZonesJson(records: FitImportRecord[], maxHr: number): string | null {
  const values = records
    .map(r => r.heart_rate ?? null)
    .filter((v): v is number => v !== null && Number.isFinite(v));
  if (values.length === 0) return null;

  const effectiveMax = maxHr > 0 ? maxHr : 190;
  const zoneCounters = [0, 0, 0, 0, 0];
  const secondsPerRecord = 1;
  for (const bpm of values) {
    const pct = bpm / effectiveMax;
    if (pct < 0.6) zoneCounters[0] += secondsPerRecord;
    else if (pct < 0.7) zoneCounters[1] += secondsPerRecord;
    else if (pct < 0.8) zoneCounters[2] += secondsPerRecord;
    else if (pct < 0.9) zoneCounters[3] += secondsPerRecord;
    else zoneCounters[4] += secondsPerRecord;
  }
  return JSON.stringify({
    z1_seconds: zoneCounters[0],
    z2_seconds: zoneCounters[1],
    z3_seconds: zoneCounters[2],
    z4_seconds: zoneCounters[3],
    z5_seconds: zoneCounters[4],
  });
}

function getMinHeartRate(records: FitImportRecord[]): number | null {
  const values = records
    .map(r => r.heart_rate ?? null)
    .filter((v): v is number => v !== null && Number.isFinite(v));
  if (values.length === 0) return null;
  return Math.min(...values);
}

function buildFitNotes(preview: FitImportPreview): string {
  const details = [preview.sport, preview.sub_sport].filter(Boolean).join(' / ');
  const importedFrom = preview.source_path ? `Source: ${preview.source_path}` : `File: ${preview.file_name}`;
  return `Imported from FIT (${details || 'workout'}). ${importedFrom}`;
}

function buildMetrics(summary: Record<string, unknown>) {
  const distanceMeters = num(summary.total_distance_meters);
  const totalTimerSeconds = num(summary.total_timer_seconds);
  const totalElapsedSeconds = num(summary.total_elapsed_seconds);
  const calories = num(summary.calories);
  const avgHeartRate = num(summary.avg_heart_rate);
  const maxHeartRate = num(summary.max_heart_rate);
  const avgCadence = num(summary.avg_cadence);
  const avgPowerWatts = num(summary.avg_power_watts);
  const maxPowerWatts = num(summary.max_power_watts);
  const elevationGain = num(summary.elevation_gain_meters);
  const elevationLoss = num(summary.elevation_loss_meters);

  const entries: Array<[string, string | null]> = [
    ['Distance', distanceMeters !== null ? `${(distanceMeters / 1000).toFixed(2)} km` : null],
    ['Duration', formatDuration(totalTimerSeconds ?? totalElapsedSeconds)],
    ['Calories', calories !== null ? `${Math.round(calories)} kcal` : null],
    ['Avg HR', avgHeartRate !== null ? `${Math.round(avgHeartRate)} bpm` : null],
    ['Max HR', maxHeartRate !== null ? `${Math.round(maxHeartRate)} bpm` : null],
    ['Avg Cadence', avgCadence !== null ? `${Math.round(avgCadence)} spm` : null],
    ['Avg Power', avgPowerWatts !== null ? `${Math.round(avgPowerWatts)} W` : null],
    ['Max Power', maxPowerWatts !== null ? `${Math.round(maxPowerWatts)} W` : null],
    ['Elevation Gain', elevationGain !== null ? `${Math.round(elevationGain)} m` : null],
    ['Elevation Loss', elevationLoss !== null ? `${Math.round(elevationLoss)} m` : null],
  ];

  return entries
    .filter((entry): entry is [string, string] => entry[1] !== null)
    .map(([label, value]) => ({ label, value }));
}

function buildRoutePoints(records: JsonObject[]): RoutePoint[] {
  const points: RoutePoint[] = [];
  for (const record of records) {
    const latRaw = num(record.position_lat) ?? num(record.position_lat_degrees) ?? num(record.latitude);
    const lngRaw = num(record.position_long) ?? num(record.position_long_degrees) ?? num(record.longitude);
    if (!latRaw || !lngRaw) continue;
    const lat = normalizeLatitude(latRaw);
    const lng = normalizeLongitude(lngRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    points.push({
      lat,
      lng,
      alt: numOrNull(record.altitude) ?? numOrNull(record.enhanced_altitude) ?? undefined,
      t: toTimestampMs(record.timestamp),
    });
  }

  if (points.length <= FIT_ROUTE_LIMIT) return points;
  const step = Math.ceil(points.length / FIT_ROUTE_LIMIT);
  return points.filter((_, i) => i % step === 0);
}

function buildFitRecords(records: JsonObject[]): FitImportRecord[] {
  return records.map((record) => ({
    lat: maybeNormalizedLat(record),
    lng: maybeNormalizedLng(record),
    altitude_meters: numOrNull(record.altitude) ?? numOrNull(record.enhanced_altitude),
    timestamp: parseDateIso(record.timestamp),
    elapsed_seconds: numOrNull(record.elapsed_time),
    distance_meters: numOrNull(record.distance),
    heart_rate: numOrNull(record.heart_rate),
    cadence_spm: numOrNull(record.cadence),
    power_watts: numOrNull(record.power),
    temperature_celsius: numOrNull(record.temperature),
    speed_mps: numOrNull(record.speed) ?? numOrNull(record.enhanced_speed),
  }));
}

function parseDateIso(value: unknown): string | null {
  if (typeof value === 'string') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return null;
}

function firstRecordTimestamp(records: JsonObject[]): unknown {
  if (records.length === 0) return null;
  return records[0].timestamp;
}

function lastRecordTimestamp(records: JsonObject[]): unknown {
  if (records.length === 0) return null;
  return records[records.length - 1].timestamp;
}

function toTimestampMs(value: unknown): number | undefined {
  const iso = parseDateIso(value);
  if (!iso) return undefined;
  return new Date(iso).getTime();
}

function maybeNormalizedLat(record: JsonObject): number | undefined {
  const lat = num(record.position_lat) ?? num(record.position_lat_degrees) ?? num(record.latitude);
  if (!lat) return undefined;
  return normalizeLatitude(lat);
}

function maybeNormalizedLng(record: JsonObject): number | undefined {
  const lng = num(record.position_long) ?? num(record.position_long_degrees) ?? num(record.longitude);
  if (!lng) return undefined;
  return normalizeLongitude(lng);
}

function normalizeLatitude(value: number): number {
  return Math.abs(value) > 180 ? semicirclesToDegrees(value) : value;
}

function normalizeLongitude(value: number): number {
  return Math.abs(value) > 180 ? semicirclesToDegrees(value) : value;
}

function semicirclesToDegrees(v: number): number {
  return v * (180 / 2147483648);
}

function toObject(value: unknown): JsonObject {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as JsonObject;
  }
  return {};
}

function toObjectArray(value: unknown): JsonObject[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is JsonObject => !!v && typeof v === 'object' && !Array.isArray(v));
}

function num(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
}

function numOrNull(value: unknown): number | null {
  return num(value);
}

function strOrFallback(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function strOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function metersToUnit(distanceMeters: number, unit: DistanceUnit): number {
  if (unit === 'mi') return distanceMeters / 1609.34;
  return distanceMeters / 1000;
}

function convertDistanceUnits(value: number, from: DistanceUnit, to: DistanceUnit): number {
  if (from === to) return value;
  if (from === 'mi' && to === 'km') return value * 1.60934;
  return value / 1.60934;
}

function formatDuration(totalSeconds: number | null): string | null {
  if (!totalSeconds || totalSeconds <= 0) return null;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
