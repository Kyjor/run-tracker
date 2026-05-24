import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSettings } from '../../contexts/SettingsContext';
import {
  getLiveRunSnapshot,
  subscribeLiveRunUpdates,
  type LiveRunSnapshot,
} from '../../services/liveRunTrackingService';
import { formatDistance, formatDuration } from '../../utils/paceUtils';

export function ActiveRunBanner() {
  const navigate = useNavigate();
  const location = useLocation();
  const { settings } = useSettings();
  const [snapshot, setSnapshot] = useState<LiveRunSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    let pollId: number | undefined;

    async function refresh() {
      const next = await getLiveRunSnapshot();
      if (!cancelled) setSnapshot(next);
    }

    void refresh();

    void subscribeLiveRunUpdates((next) => {
      if (!cancelled) setSnapshot(next);
    }).then((fn) => {
      unlisten = fn;
    });

    pollId = window.setInterval(() => {
      void refresh();
    }, 2000);

    return () => {
      cancelled = true;
      if (unlisten) unlisten();
      if (pollId != null) window.clearInterval(pollId);
    };
  }, []);

  if (location.pathname.startsWith('/log/live')) return null;
  if (!snapshot || snapshot.state !== 'running') return null;

  const distanceValue = snapshot.distance_meters <= 0
    ? 0
    : settings.units === 'mi'
      ? snapshot.distance_meters / 1609.34
      : snapshot.distance_meters / 1000;

  return (
    <button
      type="button"
      onClick={() => navigate('/log/live')}
      className="mx-4 mb-2 mt-2 flex items-center justify-between gap-3 rounded-2xl bg-primary-500 px-4 py-3 text-left text-white shadow-md"
    >
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-white/80">Run in progress</p>
        <p className="text-sm font-semibold">
          {formatDuration(Math.floor(snapshot.elapsed_seconds))}
          {' · '}
          {formatDistance(distanceValue, settings.units)}
        </p>
      </div>
      <span className="text-xs font-semibold text-white/90">Return to run</span>
    </button>
  );
}
