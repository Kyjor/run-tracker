import { useEffect } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { hideHomeAdBanner, showHomeAdBanner } from '../../services/adsService';

/**
 * Home-screen-only banner slot. Native AdMob overlays this spacer on iOS.
 * Hidden when ads_removed is set (Remove Ads IAP).
 */
export function HomeAdBanner() {
  const { settings } = useSettings();
  const show = !settings.ads_removed;

  useEffect(() => {
    if (!show) {
      void hideHomeAdBanner();
      return;
    }
    void showHomeAdBanner();
    return () => {
      void hideHomeAdBanner();
    };
  }, [show]);

  if (!show) return null;

  return (
    <div
      className="w-full h-[50px] flex items-center justify-center bg-surface/80 dark:bg-surface-dark/80"
      aria-hidden
    >
      {/* Placeholder visible in web/dev; on device the native banner covers this */}
      <span className="text-[10px] uppercase tracking-wide text-ink-muted dark:text-ink-dark-muted">
        Ad
      </span>
    </div>
  );
}
