import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Header } from '../components/navigation/Header';
import { Button } from '../components/ui/Button';
import { Card, SectionHeader } from '../components/ui/Card';
import { Spinner } from '../components/ui/Spinner';
import { useDb } from '../contexts/DatabaseContext';
import { useSettings } from '../contexts/SettingsContext';
import { useToast } from '../contexts/ToastContext';
import type { FitImportPreview, FitImportResult } from '../types';
import {
  annotateFitDuplicates,
  importFitWorkouts,
  parseFitFile,
  parsePendingFitPayload,
  type PendingFitFilePayload,
} from '../services/fitImportService';

interface FitImportLocationState {
  pendingFit?: PendingFitFilePayload;
}

export function FitImportScreen() {
  const db = useDb();
  const { settings } = useSettings();
  const { showToast } = useToast();
  const location = useLocation();
  const state = (location.state as FitImportLocationState | null) ?? null;

  const [previews, setPreviews] = useState<FitImportPreview[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResults, setLastResults] = useState<FitImportResult[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const consumedPendingRef = useRef<string | null>(null);

  useEffect(() => {
    const pendingFit = state?.pendingFit;
    if (!pendingFit || !pendingFit.base64_data) return;

    const pendingKey = `${pendingFit.file_name}:${pendingFit.base64_data.length}`;
    if (consumedPendingRef.current === pendingKey) return;
    consumedPendingRef.current = pendingKey;

    void loadPendingPayload(pendingFit);
  }, [state?.pendingFit]);

  const selectedCount = selectedIds.size;
  const selectedPreviews = useMemo(
    () => previews.filter(preview => selectedIds.has(preview.id)),
    [previews, selectedIds],
  );

  async function loadPendingPayload(pendingFit: PendingFitFilePayload) {
    setError(null);
    setIsParsing(true);
    try {
      const parsed = await parsePendingFitPayload(pendingFit);
      const withDuplicates = await annotateFitDuplicates(db, parsed, settings.units);
      setPreviews(withDuplicates);
      setSelectedIds(new Set(withDuplicates.map(p => p.id)));
      showToast(`Loaded ${withDuplicates.length} workout(s) from ${pendingFit.file_name}`, 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to parse FIT payload';
      setError(message);
      showToast(message, 'error');
    } finally {
      setIsParsing(false);
    }
  }

  async function handleSelectFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setLastResults([]);
    setIsParsing(true);
    try {
      const parsed = await parseFitFile(file);
      const withDuplicates = await annotateFitDuplicates(db, parsed, settings.units);
      setPreviews(withDuplicates);
      setSelectedIds(new Set(withDuplicates.map(p => p.id)));
      showToast(`Parsed ${withDuplicates.length} workout(s) from ${file.name}`, 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to parse FIT file';
      setError(message);
      showToast(message, 'error');
    } finally {
      setIsParsing(false);
      event.target.value = '';
    }
  }

  function toggleSelection(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleImportSelected() {
    if (!selectedPreviews.length) {
      showToast('Select at least one workout to import', 'info');
      return;
    }

    setIsImporting(true);
    setError(null);
    try {
      const results = await importFitWorkouts(
        db,
        selectedPreviews,
        settings.units,
        settings.max_heart_rate_bpm,
      );
      setLastResults(results);

      const imported = results.filter(r => r.status === 'imported').length;
      const skipped = results.filter(r => r.status === 'skipped_duplicate').length;
      const failed = results.filter(r => r.status === 'failed').length;

      const stillPendingIds = new Set(
        previews
          .filter(p => !results.some(r => r.preview_id === p.id && r.status === 'imported'))
          .map(p => p.id),
      );
      setSelectedIds(stillPendingIds);

      const updatedPreviews = previews.map(preview => {
        const result = results.find(r => r.preview_id === preview.id);
        if (result?.status === 'imported') {
          return { ...preview, duplicate_of_run_id: result.run_id ?? preview.duplicate_of_run_id };
        }
        return preview;
      });
      setPreviews(updatedPreviews);

      showToast(`Imported: ${imported}, skipped: ${skipped}, failed: ${failed}`, failed > 0 ? 'error' : 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import failed';
      setError(message);
      showToast(message, 'error');
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header title="Import FIT Workouts" showBack />

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24">
        <div className="flex flex-col gap-4">
          <div>
            <SectionHeader title="Choose File" />
            <Card className="flex flex-col gap-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Import one or more workouts from a FIT activity file and review all detected metrics before saving.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isParsing || isImporting}
                >
                  Select .fit File
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setPreviews([]);
                    setSelectedIds(new Set());
                    setLastResults([]);
                    setError(null);
                  }}
                  disabled={isParsing || isImporting || previews.length === 0}
                >
                  Clear
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".fit,application/octet-stream"
                className="hidden"
                onChange={handleSelectFile}
              />
            </Card>
          </div>

          {(isParsing || isImporting) && (
            <Card className="flex items-center gap-3">
              <Spinner size="sm" className="text-primary-500" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {isParsing ? 'Parsing FIT file...' : 'Importing selected workouts...'}
              </p>
            </Card>
          )}

          {error && (
            <Card className="border-red-300 dark:border-red-700">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </Card>
          )}

          {previews.length > 0 && (
            <div>
              <SectionHeader
                title="Preview"
                action={
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {selectedCount}/{previews.length} selected
                  </span>
                }
              />
              <div className="flex flex-col gap-3">
                {previews.map(preview => (
                  <FitPreviewCard
                    key={preview.id}
                    preview={preview}
                    selected={selectedIds.has(preview.id)}
                    onToggle={() => toggleSelection(preview.id)}
                  />
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  onClick={handleImportSelected}
                  isLoading={isImporting}
                  disabled={selectedCount === 0 || isParsing}
                >
                  Import Selected Workouts
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setSelectedIds(new Set(previews.map(p => p.id)))}
                  disabled={previews.length === 0 || isImporting || isParsing}
                >
                  Select All
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setSelectedIds(new Set())}
                  disabled={selectedCount === 0 || isImporting || isParsing}
                >
                  Deselect All
                </Button>
              </div>
            </div>
          )}

          {lastResults.length > 0 && (
            <div>
              <SectionHeader title="Import Results" />
              <Card className="flex flex-col gap-2">
                {lastResults.map(result => (
                  <p
                    key={result.preview_id}
                    className={`text-xs ${
                      result.status === 'imported'
                        ? 'text-green-600 dark:text-green-400'
                        : result.status === 'skipped_duplicate'
                          ? 'text-yellow-600 dark:text-yellow-400'
                          : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {result.status === 'imported'
                      ? `Imported workout (${result.run_id ?? 'unknown id'})`
                      : result.status === 'skipped_duplicate'
                        ? 'Skipped duplicate workout'
                        : `Failed to import: ${result.message ?? 'Unknown error'}`}
                  </p>
                ))}
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FitPreviewCard({
  preview,
  selected,
  onToggle,
}: {
  preview: FitImportPreview;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <Card className={preview.duplicate_of_run_id ? 'border-yellow-300 dark:border-yellow-700' : ''}>
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            aria-label="Select workout for import"
          />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {new Date(preview.started_at).toLocaleString()}
              </p>
              <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                {preview.sport}
              </span>
              {preview.sub_sport && (
                <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                  {preview.sub_sport}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 break-all">
              {preview.file_name}
            </p>
          </div>
        </div>

        {preview.duplicate_of_run_id && (
          <p className="text-xs text-yellow-700 dark:text-yellow-400">
            Possible duplicate of run `{preview.duplicate_of_run_id}`. Import will skip by default.
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          {preview.metrics.map(metric => (
            <div key={metric.label} className="rounded-xl bg-gray-50 dark:bg-gray-900 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{metric.label}</p>
              <p className="text-xs font-medium text-gray-900 dark:text-gray-100">{metric.value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 text-[11px]">
          <span className="px-2 py-1 rounded-full bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
            Records: {preview.records_count}
          </span>
          <span className="px-2 py-1 rounded-full bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
            Laps: {preview.laps_count}
          </span>
          <span className="px-2 py-1 rounded-full bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
            Route: {preview.has_route ? `${preview.route_points.length} points` : 'None'}
          </span>
        </div>
      </div>
    </Card>
  );
}
