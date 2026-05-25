import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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

  const visible = !location.pathname.startsWith('/log/live') && snapshot?.state === 'running';

  const distanceValue = !snapshot || snapshot.distance_meters <= 0
    ? 0
    : settings.units === 'mi'
      ? snapshot.distance_meters / 1609.34
      : snapshot.distance_meters / 1000;

  return (
    <AnimatePresence>
      {visible && snapshot && (
        <motion.button
          type="button"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
          onClick={() => navigate('/log/live')}
          className="mx-4 mb-2 mt-2 flex items-center justify-between gap-3 rounded-2xl bg-primary-600 px-4 py-3 text-left text-white shadow-elevated"
        >
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-white/80">Run in progress</p>
              <p className="text-sm font-semibold tabular-nums">
                {formatDuration(Math.floor(snapshot.elapsed_seconds))}
                {' · '}
                {formatDistance(distanceValue, settings.units)}
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-white/90">Resume</span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
