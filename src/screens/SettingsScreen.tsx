import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/navigation/Header';
import { Card, SectionHeader } from '../components/ui/Card';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Spinner } from '../components/ui/Spinner';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { useDb } from '../contexts/DatabaseContext';
import { useToast } from '../contexts/ToastContext';
import { forceSyncToCloud, pullFromCloud } from '../services/syncService';
import { exportFullBackup, exportRunsCsv, restoreFromBackup, validateBackup } from '../services/backupService';
import type { PaceZones, PaceZoneType } from '../types';
import { PACE_ZONE_LABELS } from '../types';
import { formatPaceFromSeconds, parsePaceString } from '../utils/workoutUtils';

export function SettingsScreen() {
  const navigate = useNavigate();
  const db = useDb();
  const { settings, updateSettings } = useSettings();
  const { user, signOut } = useAuth();
  const { showToast } = useToast();

  const [syncing, setSyncing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [clearModal, setClearModal] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState('');
  const [isClearing, setIsClearing] = useState(false);

  // ---------------------------------------------------------------------------
  // Sync
  // ---------------------------------------------------------------------------
  async function handleSync() {
    if (!user) { showToast('Sign in to sync', 'info'); return; }
    setSyncing(true);
    try {
      // First push any local changes up, then pull remote changes down
      await forceSyncToCloud(db);
      await pullFromCloud(db);
      showToast('Sync complete ✓', 'success');
    } catch {
      showToast('Sync failed', 'error');
    } finally {
      setSyncing(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Backup / Export
  // ---------------------------------------------------------------------------
  async function handleExportJSON() {
    setExporting(true);
    try {
      const backup = await exportFullBackup(db);
      const json = JSON.stringify(backup, null, 2);
      downloadText(json, 'runwithfriends-backup.json', 'application/json');
      showToast('Backup exported!', 'success');
    } catch {
      showToast('Export failed', 'error');
    } finally {
      setExporting(false);
    }
  }

  async function handleExportCSV() {
    setExporting(true);
    try {
      const csv = await exportRunsCsv(db);
      downloadText(csv, 'runs.csv', 'text/csv');
      showToast('CSV exported!', 'success');
    } catch {
      showToast('Export failed', 'error');
    } finally {
      setExporting(false);
    }
  }

  async function handleRestoreFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoring(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!validateBackup(parsed)) {
        showToast('Invalid backup file', 'error');
        return;
      }
      await restoreFromBackup(db, parsed);
      showToast('Restore complete. Please restart the app.', 'success');
    } catch (err) {
      showToast(`Restore failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setRestoring(false);
      e.target.value = '';
    }
  }

  async function handleClearData() {
    if (clearConfirmText !== 'I want to clear my local data') {
      showToast('Please type the confirmation phrase exactly', 'error');
      return;
    }
    setIsClearing(true);
    try {
      await db.execute('DELETE FROM runs');
      await db.execute('DELETE FROM goals');
      await db.execute('UPDATE active_plan SET is_active = 0');
      await db.execute("DELETE FROM training_plans WHERE is_builtin = 0");
      showToast('All local data cleared', 'info');
      setClearModal(false);
      setClearConfirmText('');
      navigate('/home', { replace: true });
    } catch (error) {
      console.error('Failed to clear data:', error);
      showToast('Failed to clear data', 'error');
    } finally {
      setIsClearing(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-y-auto pb-24">
      <Header title="Settings" showBack />

      <div className="px-4 pt-4 flex flex-col gap-6">
        {/* Preferences */}
        <div>
          <SectionHeader title="Preferences" />
          <Card className="flex flex-col gap-4">
            <Select
              label="Distance Units"
              options={[{ value: 'mi', label: 'Miles' }, { value: 'km', label: 'Kilometers' }]}
              value={settings.units}
              onChange={e => updateSettings({ units: e.target.value as 'mi' | 'km' })}
            />
            <Select
              label="Appearance"
              options={[
                { value: 'system', label: 'System Default' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
              value={settings.dark_mode}
              onChange={e => updateSettings({ dark_mode: e.target.value as 'system' | 'light' | 'dark' })}
            />
          </Card>
        </div>

        {/* Account & Sync */}
        <div>
          <SectionHeader title="Account & Sync" />
          <Card className="flex flex-col gap-4">
            {user ? (
              <>
                <p className="text-sm text-gray-600 dark:text-gray-400">Signed in as <strong>{user.email}</strong></p>
                <Button variant="secondary" isLoading={syncing} onClick={handleSync}>
                  {syncing ? 'Syncing…' : 'Sync Now'}
                </Button>
                {settings.last_sync_at && (
                  <p className="text-xs text-gray-400">Last sync: {new Date(settings.last_sync_at).toLocaleString()}</p>
                )}
                <Button variant="ghost" onClick={signOut}>Sign Out</Button>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Sign in to enable cloud sync and social features.
                </p>
                <Button onClick={() => navigate('/auth')}>Sign In</Button>
              </>
            )}
          </Card>
        </div>

        {/* Pace Zones */}
        <div>
          <SectionHeader title="Pace Zones" />
          <PaceZonesEditor
            paceZones={settings.pace_zones}
            unit={settings.units}
            onChange={zones => updateSettings({ pace_zones: zones })}
          />
        </div>

        {/* Apple Health (TODO) */}
        <div>
          <SectionHeader title="Apple Health" />
          <Card>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              🍎 Apple Health integration coming soon — runs will sync automatically.
            </p>
            {/* TODO: Implement HealthKit integration via Rust backend */}
          </Card>
        </div>

        {/* Data & Backups */}
        <div>
          <SectionHeader title="Data & Backups" />
          <Card className="flex flex-col gap-3">
            <Button
              variant="secondary"
              isLoading={exporting}
              onClick={handleExportJSON}
            >
              Export All Data (JSON)
            </Button>
            <Button
              variant="secondary"
              isLoading={exporting}
              onClick={handleExportCSV}
            >
              Export Runs as CSV
            </Button>
            <label className="w-full">
              <span className="sr-only">Restore from backup</span>
              <div className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl font-medium text-base bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 cursor-pointer active:opacity-80 transition-opacity ${restoring ? 'opacity-50' : ''}`}>
                {restoring && <Spinner size="sm" />}
                Restore from Backup
              </div>
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleRestoreFile}
                disabled={restoring}
              />
            </label>
            <Button
              variant="danger"
              onClick={() => setClearModal(true)}
            >
              Clear All Local Data
            </Button>
          </Card>
        </div>

        {/* About */}
        <div>
          <SectionHeader title="About" />
          <Card>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Run With Friends v0.1.0
            </p>
          </Card>
        </div>
      </div>

      <Modal
        isOpen={clearModal}
        onClose={() => {
          setClearModal(false);
          setClearConfirmText('');
        }}
        title="Clear All Data"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            This will permanently delete all your local runs, goals, and custom plans. Export a backup first?
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            To confirm, please type: <strong className="font-mono">I want to clear my local data</strong>
          </p>
          <Input
            value={clearConfirmText}
            onChange={e => setClearConfirmText(e.target.value)}
            placeholder="I want to clear my local data"
            className="font-mono text-sm"
          />
          <div className="flex flex-col gap-2 pt-2">
            <Button
              variant="danger"
              onClick={handleClearData}
              isLoading={isClearing}
              disabled={clearConfirmText !== 'I want to clear my local data'}
              className="w-full"
            >
              Clear All Data
            </Button>
            <button
              className="text-gray-500 dark:text-gray-400 py-3 text-center"
              onClick={() => {
                setClearModal(false);
                setClearConfirmText('');
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pace Zones Editor
// ---------------------------------------------------------------------------

const ZONE_ORDER: PaceZoneType[] = ['easy', 'long', 'tempo', 'intervals', 'race', 'recovery'];

function PaceZonesEditor({
  paceZones,
  unit,
  onChange,
}: {
  paceZones: PaceZones;
  unit: 'mi' | 'km';
  onChange: (z: PaceZones) => void;
}) {
  // Local draft state so user can type freely before committing
  const [drafts, setDrafts] = useState<Record<PaceZoneType, string>>(() =>
    Object.fromEntries(
      ZONE_ORDER.map(z => [z, formatPaceFromSeconds(paceZones[z], unit).replace(`/${unit}`, '')]),
    ) as Record<PaceZoneType, string>,
  );

  function handleBlur(zone: PaceZoneType, raw: string) {
    const secs = parsePaceString(raw);
    if (secs > 0) {
      onChange({ ...paceZones, [zone]: secs });
      setDrafts(d => ({ ...d, [zone]: formatPaceFromSeconds(secs, unit).replace(`/${unit}`, '') }));
    } else {
      // Reset to current saved value
      setDrafts(d => ({ ...d, [zone]: formatPaceFromSeconds(paceZones[zone], unit).replace(`/${unit}`, '') }));
    }
  }

  return (
    <Card>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Enter pace as <strong>M:SS</strong> per {unit}. These are used to estimate workout finish times.
      </p>
      <div className="flex flex-col gap-3">
        {ZONE_ORDER.map(zone => (
          <div key={zone} className="flex items-center gap-3">
            <span className="text-sm text-gray-700 dark:text-gray-300 w-20 flex-shrink-0">
              {PACE_ZONE_LABELS[zone]}
            </span>
            <div className="flex-1">
              <Input
                value={drafts[zone]}
                placeholder="M:SS"
                onChange={e => setDrafts(d => ({ ...d, [zone]: e.target.value }))}
                onBlur={e => handleBlur(zone, e.target.value)}
                hint={`/${unit}`}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function downloadText(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

